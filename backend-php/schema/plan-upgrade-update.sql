-- Upgrading by the price difference. While a paid plan is running, a dearer
-- plan costs only the difference of the two prices and keeps the current end
-- date; a cheaper one waits until the period ends. Each payment request now
-- keeps what kind of purchase it was (new, renew, upgrade, or the admin's
-- plan switch) and, for an upgrade, the plan and price it was upgraded from,
-- so approving it later does what was paid for.
-- Needs plan-limits-update.sql and trainer-billing-update.sql first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE payment_requests
  ADD COLUMN purchase_kind VARCHAR(10) NULL AFTER plan_id,
  ADD COLUMN from_plan_id CHAR(36) NULL AFTER purchase_kind,
  ADD COLUMN from_price_toman BIGINT NULL AFTER from_plan_id;

ALTER TABLE trainer_payment_requests
  ADD COLUMN purchase_kind VARCHAR(10) NULL AFTER plan_id,
  ADD COLUMN from_plan_id CHAR(36) NULL AFTER purchase_kind,
  ADD COLUMN from_price_toman BIGINT NULL AFTER from_plan_id;
