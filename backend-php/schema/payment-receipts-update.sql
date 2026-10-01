-- Payment receipts: the tracking code, last four card digits, optional paid-at
-- time and the uploaded receipt image/PDF a club files with a subscription
-- payment request. The file itself lives in public/uploads/receipts/ (closed
-- to direct web access, served through the API) and is deleted some days
-- after the request is reviewed, which clears receipt_path and sets
-- receipt_purged_at.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE payment_requests
  ADD COLUMN tracking_code      VARCHAR(40)  NULL AFTER reference_note,
  ADD COLUMN card_last4         CHAR(4)      NULL AFTER tracking_code,
  ADD COLUMN paid_at            DATETIME     NULL AFTER card_last4,
  ADD COLUMN receipt_path       VARCHAR(120) NULL AFTER paid_at,
  ADD COLUMN receipt_purged_at  DATETIME     NULL AFTER receipt_path,
  ADD KEY idx_payreq_tracking (tracking_code);
