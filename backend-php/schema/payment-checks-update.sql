-- Safer card-to-card payments: the amount the payer says they transferred
-- (the reviewer compares it with the amount due and the receipt), and a
-- marker for the "this payment has been waiting for you" reminder so it is
-- sent once. Needs the earlier payment updates (receipts, invoice claims,
-- trainer billing, member payments).
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE payment_requests
  ADD COLUMN reminded_at DATETIME NULL;

ALTER TABLE trainer_payment_requests
  ADD COLUMN paid_amount_toman BIGINT NULL AFTER amount_toman,
  ADD COLUMN reminded_at       DATETIME NULL;

ALTER TABLE invoice_payment_claims
  ADD COLUMN paid_amount_toman BIGINT NULL AFTER athlete_id,
  ADD COLUMN reminded_at       DATETIME NULL;

ALTER TABLE membership_payment_requests
  ADD COLUMN paid_amount_toman BIGINT NULL AFTER amount_toman,
  ADD COLUMN reminded_at       DATETIME NULL;
