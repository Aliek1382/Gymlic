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
  before switching it on. Once `plan-limits-update.sql` has run, the switch is
  called "اعمال محدودیت پلن‌ها" and `Limits` replaces this rule (see "Plans
  and limits" below).
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

### Plans and limits for trainers and clubs (phase 1)

The database step is `schema/plan-limits-update.sql` (after the two trainer
billing files). `src/Limits.php` is the one place that says what a plan
allows; every cap is checked on the server.

- **Plans.** Trainers: رایگان (free, 3 athletes, never expires), نقره‌ای,
  طلایی, الماسی in `trainer_plans`; clubs: نقره‌ای, طلایی, الماسی in `plans`
  (members and trainers). The plans sold before are switched off, not
  deleted. Each plan also carries the limits of the later phases (custom
  exercises, templates, history months, report level), stored but not yet
  checked. NULL = unlimited.
- **Every trainer has a plan.** Without a paid one it is the free plan; no row
  is needed. Subscriptions now point at their plan (`plan_id`), so editing a
  plan's caps reaches everyone on it at once (the plan dialogs preview who
  ends up above the new cap).
- **States**, worked out from `expires_at` on every read, no cron: active →
  expiring (`billing.expiring_days` before the end) → grace
  (`billing.grace_days` after it, everything still works, a banner says so)
  → expired. An expired trainer is on the free plan again: the athletes above
  its cap are put on hold (`trainer_athletes.suspended_by_plan`) on the first
  request that looks at the trainer after the grace days, the trainer's pick
  (`/subscription/athletes`) first, then the most recently seen. On hold =
  plans and data read-only, no new plans, no messages either way; nothing is
  deleted. Any renewal brings everyone back. An expired club can't invite
  anyone new; nobody is put on hold.
- **Mid-period purchases:** the same plan extends from the current end; a
  different plan starts on approval with its full period (no carry-over).
- **Club trainers:** an invite from a trainer who belongs to a club carries
  the club and counts against the club's member cap; only athletes coached
  outside a club count against the trainer's own plan.
- **Caps are checked when an invite is created and again when it is accepted**
  (with the trainer's or club's row locked). An invite that no longer fits is
  revoked and its sender notified.
- **Admin** (`/admin/subscriptions`, finance permission): every trainer and
  club with plan, state, dates and usage; filters, search, CSV. Per account:
  activate a plan from a start date (today or earlier) to any end date, with
  an optional payment received outside the site; change the dates (an end
  today or earlier starts the grace days); extend; a cap override on that
  subscription (cleared by a plan change, ignored after the grace days);
  bring a trainer's athletes back; revoke open invites. Each change can be
  previewed and is logged with before/after and a note (the history tab).
- **Nothing is enforced** until "اعمال محدودیت پلن‌ها" (`billing.trainer_enforce`)
  is on in `/admin/billing`; until then caps are only shown. The one check
  that predates this, a club manager's invite against the member cap, runs
  either way.
- **Custom exercises and templates (phase 2).** A trainer's own custom
  exercises (`max_custom_exercises`) and templates, workout and nutrition
  together (`max_templates`), are capped by the plan in effect; no caps while
  the trainer's club has a plan running. Checked with the trainer's row
  locked on every path that makes one: `POST /library/exercises`, saving or
  copying a template (`POST /plans/{kind}/templates`, with or without
  `source_id`) and copying from the content library; 402 `exercise_limit` /
  `template_limit`. What a trainer already has above the cap (after a paid
  plan ended) stays usable and editable; only making more is refused.
  Trainers can now edit their own exercises (`PATCH /library/exercises/{id}`)
  and delete one no plan uses (`DELETE`, 409 `in_use` otherwise), which frees
  a place. Food and supplement libraries have no cap.
- **Tiers** (`Tiers`, /admin/tiers) still decide which panel sections each
  plan opens; the seven plans carry their tier (free/silver/gold/diamond),
  and a plan counts as running for tiers through its grace days too. The
  free tier's caps from /admin/tiers apply only while enforcement is off;
  with it on, the plans' caps (`Limits`) decide.
- `tests/plan-limits-scenarios.php` runs the scenarios against a local API and
  a `*_dev` database (never the live site).

## Athlete → club card-to-card membership payments

An athlete pays their club for a membership plan from "عضویت من"
(`/membership`); a club owner or reception approves it in "پرداخت‌های اعضا"
(`/member-payments`). The database step is `schema/member-payments-update.sql`
(admin panel's database page, or phpMyAdmin); until it has run the endpoints
answer `ready: false` / 409 and the pages hide the feature.

- The club saves its receiving card in Settings → "دریافت پرداخت"
  (`club_payment_info`, `GET/PUT /clubs/{id}/payment-info`, owner or reception,
  card number Luhn-checked via `CardInfo`). Athletes see it only for a club they
  are an active athlete member of.
- The athlete picks one of the club's active, non-free plans and files the
  payment: `POST /member-payments` with tracking code, last four card digits
  and a receipt (same rules, size ceiling, shrinking and retention as the other
  receipts, from the admin's billing settings). The plan's name, duration and
  price are copied onto the request. One waiting request per athlete per club.
- The owner and reception are notified (`member_payment_submitted`). Approving
  (`POST /member-payments/{id}/approve`, one transaction) extends the
  membership from the current expiry while it still runs, else from today, sets
  its plan, writes the amount into `revenue_entries` (category `membership`,
  recorded by the approver) and tells the athlete. Rejecting lets the athlete
  file again, with the reason in the notification.
- Receipt files (`GET /member-payments/{id}/receipt`: the athlete, or a manager
  of that club) are deleted by the same cleanup as the others, N days after the
  review; a manager can also delete one by hand.
- Discount codes on membership plans are below; a reminder when a membership
  is about to end is not covered.

### Discount codes made by clubs and trainers

The database step is `schema/member-discounts-update.sql` (after
`member-payments-update.sql` and `invoice-claims-update.sql`); until it has run
the code boxes and tabs are simply off.

- **A club's codes for its membership plans** (`club_discount_codes`, unique
  per club): owner or reception manage them in "پرداخت‌های اعضا" → "کدهای
  تخفیف" (`/clubs/{id}/discount-codes`). The athlete enters a code in the pay
  dialog (`POST /member-payments/discount-check`, then `discount_code` on
  `POST /member-payments`); the request stores the plan price, the discount and
  the discounted `amount_toman`, so approving puts the discounted amount in the
  club's revenue.
- **A trainer's codes for their athletes' invoices** (`athlete_discount_codes`,
  unique per trainer): managed in "فاکتورهای من" → "کدهای تخفیف"
  (`/athlete-discount-codes`). The athlete enters it with "پرداخت کردم"
  (`POST /invoices/{id}/discount-check`, then `discount_code` on the claim); the
  claim keeps the discount, the trainer sees the amount that should have been
  paid, and approving settles the invoice for that amount
  (`InvoiceController::settle`'s `$paidAmount`).
- The rules are the platform codes' (`DiscountCodes`): percent or amount, one
  plan or all (club codes only), a cap on total uses, once per person, an
  expiry date, active/inactive. A use is a pending or approved payment, so a
  rejected one gives its use back. A code can never make a payment free (percent
  is capped at 99, and a code that would take the whole price is refused when
  used), and a used code can be switched off but not deleted.
