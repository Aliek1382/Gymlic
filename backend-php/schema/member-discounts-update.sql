-- Discount codes for card-to-card payments between people: a club's codes for
-- its membership plans (paid by athletes), and a trainer's codes for the
-- invoices of their athletes. Both are managed by the club / trainer
-- themselves, scoped to them. Needs member-payments-update.sql and
-- invoice-claims-update.sql first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE club_discount_codes (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  club_id         CHAR(36) NOT NULL,
  code            VARCHAR(40) NOT NULL,             -- stored upper-case, matched case-insensitively
  kind            ENUM('percent','amount') NOT NULL,
  value           BIGINT NOT NULL,                  -- 1..100 for percent, toman for amount
  plan_id         CHAR(36) NULL,                    -- NULL = any membership plan of the club
  max_uses        INT NULL,                         -- NULL = unlimited, pending and approved payments count
  once_per_member TINYINT(1) NOT NULL DEFAULT 0,
  expires_at      DATETIME NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  note            VARCHAR(255) NULL,
  created_by      CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cdc_club_code (club_id, code),
  CONSTRAINT fk_cdc_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdc_plan FOREIGN KEY (plan_id) REFERENCES club_membership_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdc_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_cdc_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE membership_payment_requests
  ADD COLUMN discount_code_id CHAR(36) NULL AFTER amount_toman,
  ADD COLUMN list_price_toman BIGINT NULL AFTER discount_code_id,
  ADD COLUMN discount_toman   BIGINT NOT NULL DEFAULT 0 AFTER list_price_toman,
  ADD CONSTRAINT fk_mpr_discount FOREIGN KEY (discount_code_id) REFERENCES club_discount_codes(id) ON DELETE SET NULL;

CREATE TABLE athlete_discount_codes (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id        CHAR(36) NOT NULL,
  code              VARCHAR(40) NOT NULL,
  kind              ENUM('percent','amount') NOT NULL,
  value             BIGINT NOT NULL,
  max_uses          INT NULL,                       -- pending and approved claims count
  once_per_athlete  TINYINT(1) NOT NULL DEFAULT 0,
  expires_at        DATETIME NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  note              VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_adc_trainer_code (trainer_id, code),
  CONSTRAINT fk_adc_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_adc_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE invoice_payment_claims
  ADD COLUMN discount_code_id CHAR(36) NULL AFTER athlete_id,
  ADD COLUMN list_price_toman BIGINT NULL AFTER discount_code_id,
  ADD COLUMN discount_toman   BIGINT NOT NULL DEFAULT 0 AFTER list_price_toman,
  ADD CONSTRAINT fk_claims_discount FOREIGN KEY (discount_code_id) REFERENCES athlete_discount_codes(id) ON DELETE SET NULL;
