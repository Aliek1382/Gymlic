# Gymlic PHP/MySQL backend (shared-hosting rewrite)

Replaces the Supabase backend with plain PHP (no Composer/SSH required) + MySQL,
for deployment on ordinary Iranian cPanel shared hosting. The Next.js frontend
does not need to change structurally — only its `features/*/services/*.ts`
files need to call this REST API instead of `supabase-js`.

## Status

This is the MVP slice: full database schema + auth (signup/login/logout/me/
choose-role), club creation, and the invitation-accept flow (join as athlete /
join as trainer). Everything else in `../supabase/migrations` (members,
trainers, plans, exercises, foods, messages, revenue, admin panel, etc.) still
needs its own controller + routes, following the same pattern — see the
Supabase→PHP inventory this was built from for the full endpoint list per
feature.

## Deploying on shared hosting (no SSH)

1. In cPanel → MySQL Databases, create a database and a user, and add the user
   to the database with ALL PRIVILEGES.
2. In phpMyAdmin, select that database → Import → upload `schema/schema.sql`.
3. Upload this whole `backend-php/` folder via FTP/File Manager, in one of two
   layouts (both are supported and both keep `src/`, `config.php` and
   `schema/` unreachable over HTTP):

   **A. Subdomain (recommended).** Upload to `~/backend-php/`, then create a
   subdomain like `api.yourdomain.com` with its document root set to
   `backend-php/public`. Endpoints are then `https://api.yourdomain.com/health`.

   **B. Subfolder.** Upload the folder to `~/public_html/api/` (so that
   `public_html/api/.htaccess` and `public_html/api/public/` both exist).
   Endpoints are then `https://yourdomain.com/api/health`.

4. Edit `config.php`: the DB host/name/user/password from step 1, and your
   frontend's real origin(s) in `cors_origins`.
5. Make sure `public/uploads/` is writable by PHP (`755`, or `775` on some
   hosts).
6. Check the deployment: open `<your API base>/health` in a browser. You want
   `{"ok":true,"database":"connected","schema":"loaded"}`. `"database":
   "unavailable"` means step 4's credentials are wrong; `"schema":"missing"`
   means step 2 didn't run.
7. Point the frontend's API base URL at this deployment.

Both layouts are verified against Apache with `mod_rewrite`: requests route to
the front controller, `/uploads/...` is served straight off disk, and
`src/`, `schema/` and `config.php` are not fetchable.

## Local development

```
php -S 127.0.0.1:8099 public/index.php
```

Point `config.php` at a local MySQL/MariaDB database seeded from
`schema/schema.sql`.

## Auth model

Bearer-token sessions (`sessions` table), not cookies — the static frontend
export and this API commonly live on different (sub)domains on shared
hosting, where cross-site cookies are fragile. The frontend stores the token
(e.g. `localStorage`) and sends `Authorization: Bearer <token>`, the same
shape as the Supabase JWT it replaces.

## Adding a new feature/endpoint

1. Add a table to `schema/schema.sql` if needed (see the Postgres migration
   it corresponds to under `../supabase/migrations`).
2. Add a controller under `src/Controllers/`, using `Auth::requireUser()` /
   `Auth::requirePlatformAdmin()` for the authorization checks Postgres RLS
   used to do (each table's former RLS policy tells you exactly what to
   check — see the migration file).
3. Register its routes in `public/index.php`.

## Cron: calendar reminders

Reminders for calendar events are sent by `cron/calendar-reminders.php`, which
must be run by the host's cron every 5 minutes (command line only; over HTTP it
answers 404):

```
*/5 * * * * php /home/USER/path/to/backend-php/cron/calendar-reminders.php
```

Use the same `php` binary the site runs on (in cPanel: Cron Jobs → the path
shown there for PHP 8.1). The script prints how many reminders it sent.

### Supplement reminders

`cron/calendar-reminders.php` also sends the supplement plans' reminders
(`SupplementController::sendDueReminders()`), so the same 5-minute cron entry
covers them and nothing new has to be added in cPanel. Each plan item reminds
once a day within 30 minutes after its time, at: breakfast 08:00, lunch 13:00,
dinner 20:00, before sleep 22:30 (Asia/Tehran), or its `custom_time`.
`before_workout` / `after_workout` items remind only if a `custom_time` is set.

`cron/supplement-reminders.php` runs just that part, for testing on a dev
machine: `php cron/supplement-reminders.php`. Running it again the same day
sends nothing new (`supplement_plan_items.last_reminded_on`).

## Cron: SMS / email notifications

Users can opt in (Settings) to get their notifications by SMS and/or email.
`AuthController::notify` only queues a row in `notification_deliveries`;
`cron/notification-dispatch.php` sends up to 50 queued rows per run through
`SmsGateway` (Melipayamak) and `MailGateway` (PHP `mail()`, or SMTP if
`mail.smtp.host` is set in `config.php`). A row is tried at most 3 times; the
reason for a failure is in `notification_deliveries.last_error`.

```
*/5 * * * * php /home/USER/path/to/backend-php/cron/notification-dispatch.php
```

One cron entry can run both scripts:
`php .../cron/calendar-reminders.php; php .../cron/notification-dispatch.php`.
The database step is `schema/notification-channels-update.sql` (run by hand in
phpMyAdmin before deploying the backend), and `config.php` on the host needs the
new `sms` and `mail` keys copied in by hand.

## Cron: assessment (measurement) reminders

A trainer can ask to be reminded, per athlete, to have measurements re-recorded
every 2/4/6/8 weeks (`assessment_reminders`). `cron/assessment-reminders.php`
notifies the athlete (`type = assessment_reminder`, link `/progress`) once the
latest measurement is older than the interval, and not again within the same
interval. Once a day is enough:

```
0 8 * * * php /home/USER/path/to/backend-php/cron/assessment-reminders.php
```

It can also be chained onto the existing entry
(`php .../calendar-reminders.php; php .../assessment-reminders.php`) — it is
cheap, and the interval guard makes extra runs harmless. The database step is
`schema/assessment-reminders-update.sql` (run by hand in phpMyAdmin before
deploying the backend). If the athlete has opted in to SMS/email, the copy goes
out through the notification-dispatch cron like any other notification.

## Cron: gymlic.ir articles in the news

`cron/news-fetch.php` copies the newest articles of gymlic.ir's WordPress RSS
feed (`https://gymlic.ir/feed/`, or `news_feed_url` if `config.php` defines it)
into `news_items`, where the panel shows them next to the news the platform
admin writes. Once an hour is plenty:

```
0 * * * * php /home/USER/path/to/backend-php/cron/news-fetch.php
```

Running it again imports nothing twice (`news_items.link_hash` is unique). A feed
that is down or malformed prints the reason to stderr and exits 1; the articles
already stored are untouched. The database step is `schema/news-update.sql`
(run by hand in phpMyAdmin before deploying the backend).
