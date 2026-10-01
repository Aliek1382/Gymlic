-- Card-to-card payment of a club membership: the club's receiving card
-- details, and the payment an athlete files for one of the club's membership
-- plans (tracking code, last four card digits, optional receipt image or
-- PDF). When a club manager approves one, the membership is extended and the
-- amount lands in the club's revenue ledger. Receipt files are stored and
-- deleted like the other receipts (see payment-receipts-update.sql).
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE club_payment_info (
  club_id     CHAR(36) NOT NULL PRIMARY KEY,
  card_number VARCHAR(19) NULL,
  sheba       VARCHAR(26) NULL,
  holder_name VARCHAR(100) NULL,
  bank_name   VARCHAR(60) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cpi_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE membership_payment_requests (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  club_id           CHAR(36) NOT NULL,
  athlete_id        CHAR(36) NOT NULL,
  plan_id           CHAR(36) NULL,
  plan_name         VARCHAR(255) NOT NULL,
  duration_days     INT NOT NULL,
  amount_toman      BIGINT NOT NULL,
  tracking_code     VARCHAR(40) NOT NULL,
  card_last4        CHAR(4) NOT NULL,
  paid_at           DATETIME NULL,
  note              VARCHAR(500) NULL,
  receipt_path      VARCHAR(120) NULL,
  receipt_purged_at DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  review_note       VARCHAR(500) NULL,
  reviewed_by       CHAR(36) NULL,
  reviewed_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mpr_club (club_id, status, created_at DESC),
  KEY idx_mpr_athlete (athlete_id, created_at DESC),
  KEY idx_mpr_tracking (tracking_code),
  CONSTRAINT fk_mpr_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_mpr_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mpr_plan FOREIGN KEY (plan_id) REFERENCES club_membership_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_mpr_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_mpr_amount CHECK (amount_toman > 0),
  CONSTRAINT chk_mpr_duration CHECK (duration_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
