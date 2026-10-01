-- Trainer subscriptions: a trainer pays the platform card-to-card, the same
-- way a club does. Plans are their own catalogue (so nothing a club sees
-- changes), with a cap on athletes. One subscription row per trainer, and a
-- payment request carries the tracking code, last four card digits and a
-- receipt image or PDF (stored and deleted like the club ones, see
-- payment-receipts-update.sql).
-- Nothing is enforced until the admin switches it on (billing settings).
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE trainer_plans (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  price_toman   BIGINT NOT NULL,
  duration_days INT NOT NULL,
  max_athletes  INT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_tplans_price CHECK (price_toman >= 0),
  CONSTRAINT chk_tplans_duration CHECK (duration_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trainer_subscriptions (
  trainer_id   CHAR(36) NOT NULL PRIMARY KEY,
  plan_name    VARCHAR(255) NOT NULL,
  max_athletes INT NULL,
  started_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tsub_expires (expires_at),
  CONSTRAINT fk_tsub_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trainer_payment_requests (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id        CHAR(36) NOT NULL,
  plan_id           CHAR(36) NOT NULL,
  amount_toman      BIGINT NOT NULL,
  reference_note    VARCHAR(500) NULL,
  tracking_code     VARCHAR(40) NOT NULL,
  card_last4        CHAR(4) NOT NULL,
  paid_at           DATETIME NULL,
  receipt_path      VARCHAR(120) NULL,
  receipt_purged_at DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note        VARCHAR(500) NULL,
  reviewed_by       CHAR(36) NULL,
  reviewed_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tpay_trainer (trainer_id, created_at DESC),
  KEY idx_tpay_status (status),
  KEY idx_tpay_tracking (tracking_code),
  CONSTRAINT fk_tpay_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_tpay_plan FOREIGN KEY (plan_id) REFERENCES trainer_plans(id),
  CONSTRAINT fk_tpay_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_tpay_amount CHECK (amount_toman >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
