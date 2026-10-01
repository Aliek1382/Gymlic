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

## Payment receipts (club → platform subscription payments)

A club's payment request carries a bank tracking code, the last four digits of
the card it paid from (both always required), an optional paid-at time and a
receipt photo/PDF (required unless the admin switches that off in
`/admin/billing`). The database step is `schema/payment-receipts-update.sql`
(run from the admin panel's database page, or by hand in phpMyAdmin). Until it
has run the backend behaves exactly as before: `Receipts::ready()` is false and
the payment dialog shows none of the new fields.

- Files are stored in `public/uploads/receipts/` under random names. The
  folder gets its own `.htaccess` (`Require all denied`), so nothing there is
  readable by URL; `GET /payment-requests/{id}/receipt` streams a file to the
  club that filed it and to admins with the finance permission.
- Images are shrunk in the browser (max 1400px, about 400 KB) and re-encoded
  again in `src/Receipts.php` (JPEG, 1400px, quality 75, EXIF dropped). PDFs
  are kept as sent, up to the admin's size ceiling (default 3 MB).
- A file is deleted N days after its request is **reviewed** (default 7, set in
  `/admin/billing`, 0 = keep). Requests still waiting keep theirs. Files no
  request points to are swept too. An admin can also delete one receipt from
  `/admin/payments`, or run the cleanup from `/admin/billing`.
- The cleanup is `cron/receipt-cleanup.php`, once a day:

```
30 3 * * * php /home/USER/path/to/backend-php/cron/receipt-cleanup.php
```

  Without the cron entry the same cleanup still runs, at most every six hours,
  when a club files a request or an admin opens the payment requests. Its last
  run shows up under "سلامت سایت" in `/admin/system` like the other cron jobs.

## Athlete → trainer card-to-card payments

A trainer's invoice (`invoices`) can now be paid card-to-card from the site.
The database step is `schema/invoice-claims-update.sql` (admin panel's
database page, or phpMyAdmin); before it has run the backend and pages behave
as they did (`Receipts::claimsReady()` is false, endpoints answer 409).

1. The trainer saves a receiving card in Settings (`trainer_payment_info`,
   `GET/PUT /payment-info`; the card number is Luhn-checked).
2. An athlete with a pending invoice sees that card (`pay_to` on
   `GET /invoices/mine`, only for pending invoices) and files a claim:
   `POST /invoices/{id}/claim` with tracking code, last four card digits and a
   receipt (same rules, size ceiling, shrinking and retention as the club
   payments, from the admin's billing settings). One waiting claim per invoice.
3. The trainer is notified (`invoice_claim_submitted`) and sees the claim on
   the plan, the package, the questionnaire and in `/invoices`. Approving
   (`POST /invoices/{id}/claim/approve`) goes through `InvoiceController::settle`,
   the same code as the manual "mark paid", so a session package is activated
   and the plan unlocks. Rejecting (`.../claim/reject`) tells the athlete why
   (`invoice_claim_rejected`) and lets them file again.
4. The invoice stays `pending`, and the plan locked, until a claim is approved
   or the trainer settles/cancels by hand (either closes a waiting claim).
5. Receipt files (`GET /invoice-claims/{id}/receipt`, athlete or trainer only)
   are deleted by the same cleanup as the club ones, N days after the claim is
   reviewed.

## Trainer subscriptions (trainer → platform)

A trainer pays the platform card-to-card, like a club, from "اشتراک من"
(`/subscription`). The database step is `schema/trainer-billing-update.sql`
(admin panel's database page, or phpMyAdmin); until it has run the endpoints
answer `ready: false` / 409 and the pages hide the feature.

- Own tables, so nothing a club sees changes: `trainer_plans` (price,
  duration, `max_athletes`), `trainer_subscriptions` (one row per trainer) and
  `trainer_payment_requests`. The receiving card is the same one clubs pay to
  (billing settings). A request carries the tracking code, last four card
  digits and a receipt, with the same size ceiling, shrinking and auto-delete
  as the club payments (`Receipts::SOURCES`). One waiting request per trainer.
- Admins with the finance permission manage it at `/admin/trainer-billing`:
  approve/reject requests (approving starts or extends the subscription,
  counting from the current expiry while it runs), plans, and a per-trainer
  "add days" (free days keep the trainer's plan, or pick one).
- **Nothing is enforced by default.** Switch on "الزام اشتراک مربی" in
  `/admin/billing` (`billing.trainer_enforce`) and a trainer outside a club
  needs an active subscription, within its athlete cap, to create an athlete
  invite (`TrainerBilling::inviteBlock`, HTTP 402 from `POST /athlete-invites`).
  Existing athletes are never removed, and a trainer who is an active member of
  a club is never asked to pay. Set the plans up and let trainers subscribe
  before switching it on.
- Discount codes, reminders and the revenue report are part 2, below.

### Trainer subscriptions, part 2: discount codes, reminders, revenue

The database step is `schema/trainer-billing-extras-update.sql` (after
`trainer-billing-update.sql`); until it has run the codes and reminders are
simply off.

- **Discount codes for trainer plans** (`trainer_discount_codes`, admin tab
  "کدهای تخفیف" in `/admin/trainer-billing`, `TrainerDiscounts` /
  `TrainerDiscountController`). Same rules as the club codes: percent or fixed
  amount, one plan or all, a cap on total uses, once per trainer, an expiry
  date, active/inactive. A use is a pending or approved request, so a rejected
  request gives its use back. The trainer enters the code in the purchase
  dialog and sees the price (`POST /trainer-billing/discount-check`); the code
  is checked again with its row locked when the request is filed. A code that
  covers the whole price needs no card, tracking code or receipt (stored as
  tracking code `DISCOUNT`, and the admin still approves it). A code that has
  been used cannot be deleted, only switched off.
- **Reminders** (`cron/trainer-subscription-reminders.php`, once a day):
  `trainer_subscription_expiring` once the subscription is inside the
  "running out" window of the billing settings, and
  `trainer_subscription_expired` once it has ended. Each is sent once per
  expiry (`trainer_subscriptions.reminder_stage`, reset when the subscription
  is extended); club members are skipped. They go out like any notification,
  by SMS/email too for those who opted in. Without a cron entry the same job
  runs at most every six hours when a trainer opens their subscription page or
  an admin opens the trainer payments.
  ```
  15 8 * * * php /home/USER/path/to/backend-php/cron/trainer-subscription-reminders.php
  ```
- **Revenue**: approved trainer payments are in the admin revenue report
  (`AdminBillingController::revenueSummary`: totals, by month, by plan, with
  the club/trainer split), its CSV, the overview's total revenue and pending
  count, and a new CSV `GET /admin/export/trainer-payments`.
