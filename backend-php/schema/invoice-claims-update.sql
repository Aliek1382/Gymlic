-- Card-to-card payments from an athlete to their trainer: the trainer's
-- receiving card details, and the "I paid" claims an athlete files against a
-- pending invoice (tracking code, last four card digits, optional receipt
-- image or PDF). The invoice stays pending, and its plan locked, until the
-- trainer approves a claim. Receipt files are stored and deleted like the
-- ones on club subscription payments (see payment-receipts-update.sql).
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE trainer_payment_info (
  trainer_id  CHAR(36) NOT NULL PRIMARY KEY,
  card_number VARCHAR(19) NULL,
  sheba       VARCHAR(26) NULL,
  holder_name VARCHAR(100) NULL,
  bank_name   VARCHAR(60) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tpi_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_payment_claims (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  invoice_id        CHAR(36) NOT NULL,
  athlete_id        CHAR(36) NOT NULL,
  tracking_code     VARCHAR(40) NOT NULL,
  card_last4        CHAR(4) NOT NULL,
  paid_at           DATETIME NULL,
  note              VARCHAR(500) NULL,
  receipt_path      VARCHAR(120) NULL,
  receipt_purged_at DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  trainer_note      VARCHAR(500) NULL,
  reviewed_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_claims_invoice (invoice_id, created_at DESC),
  KEY idx_claims_status (status),
  KEY idx_claims_tracking (tracking_code),
  CONSTRAINT fk_claims_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_claims_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
