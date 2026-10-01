-- Trainer subscriptions, part 2: discount codes for trainer plans, and the
-- marker that keeps the "your subscription is ending" reminders from being
-- sent twice. Needs trainer-billing-update.sql first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE trainer_discount_codes (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  code             VARCHAR(40) NOT NULL,             -- stored upper-case, matched case-insensitively
  kind             ENUM('percent','amount') NOT NULL,
  value            BIGINT NOT NULL,                  -- 1..100 for percent, toman for amount
  plan_id          CHAR(36) NULL,                    -- NULL = any trainer plan
  max_uses         INT NULL,                         -- NULL = unlimited, pending and approved requests count
  once_per_trainer TINYINT(1) NOT NULL DEFAULT 0,
  expires_at       DATETIME NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  note             VARCHAR(255) NULL,
  created_by       CHAR(36) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tdiscount_code (code),
  CONSTRAINT fk_tdiscount_plan FOREIGN KEY (plan_id) REFERENCES trainer_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_tdiscount_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_tdiscount_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE trainer_payment_requests
  ADD COLUMN discount_code_id CHAR(36) NULL AFTER amount_toman,
  ADD COLUMN list_price_toman BIGINT NULL AFTER discount_code_id,
  ADD COLUMN discount_toman   BIGINT NOT NULL DEFAULT 0 AFTER list_price_toman,
  ADD CONSTRAINT fk_tpay_discount FOREIGN KEY (discount_code_id) REFERENCES trainer_discount_codes(id) ON DELETE SET NULL;

ALTER TABLE trainer_subscriptions
  ADD COLUMN reminder_stage TINYINT NOT NULL DEFAULT 0 AFTER expires_at;
