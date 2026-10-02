-- A trainer-plan discount code can belong to one trainer: only they can use
-- it (a birthday gift, a personal offer). NULL = any trainer, as before.
-- Needs trainer-billing-extras-update.sql first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE trainer_discount_codes
  ADD COLUMN for_trainer_id CHAR(36) NULL AFTER plan_id,
  ADD KEY idx_tdiscount_for_trainer (for_trainer_id);
