-- Phase 10, part 1: the admin's operations tools.
--  * error_logs: PHP errors and errors in users' browsers, grouped by kind,
--    shown in the admin panel instead of the host's log files.
--  * trash: what an admin deletes (a user, a club, a page, a discount code)
--    kept for 30 days so it can be put back.
--  * trainer_profiles verification: an admin checks a trainer's uploaded
--    certificates and gives the "verified trainer" badge.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE error_logs (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  fingerprint CHAR(40) NOT NULL,
  source      ENUM('server','browser') NOT NULL,
  message     VARCHAR(1000) NOT NULL,
  location    VARCHAR(500) NULL,
  detail      TEXT NULL,
  url         VARCHAR(500) NULL,
  user_id     CHAR(36) NULL,
  user_agent  VARCHAR(255) NULL,
  occurrences INT NOT NULL DEFAULT 1,
  first_seen  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  UNIQUE KEY uq_error_logs_fingerprint (fingerprint),
  KEY idx_error_logs_last_seen (last_seen),
  CONSTRAINT fk_error_logs_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trash (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  kind       VARCHAR(30) NOT NULL,
  label      VARCHAR(255) NOT NULL,
  summary    VARCHAR(500) NULL,
  payload    LONGTEXT NOT NULL,
  deleted_by CHAR(36) NULL,
  deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trash_deleted_at (deleted_at),
  CONSTRAINT fk_trash_deleted_by FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE trainer_profiles
  ADD COLUMN verification_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none' AFTER social_links,
  ADD COLUMN verification_note VARCHAR(500) NULL AFTER verification_status,
  ADD COLUMN verification_requested_at DATETIME NULL AFTER verification_note,
  ADD COLUMN verified_at DATETIME NULL AFTER verification_requested_at,
  ADD COLUMN verified_by CHAR(36) NULL AFTER verified_at;
