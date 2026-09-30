-- Payment method on the trainer's manual fee ledger (trainer_payments).
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "duplicate column name" and changes nothing.
-- Do NOT re-import schema.sql.
--
-- Rows recorded before this column existed get 'cash'. That is a reasonable
-- guess, not a fact: the old form never asked, so historic method totals in
-- the financial report are an estimate.

ALTER TABLE trainer_payments
  ADD COLUMN payment_method ENUM('cash','card_transfer','online') NOT NULL DEFAULT 'cash'
  AFTER amount_toman;
