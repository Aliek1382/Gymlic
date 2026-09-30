-- Site settings the platform admin edits from /admin (feature switches,
-- maintenance mode, sign-up, announcement banner, support contact, ...).
-- One row per settings group; `value` is that group's JSON. A missing row
-- means "defaults", so this table starts empty.
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "table already exists" and changes nothing.
-- Do NOT re-import schema.sql.

CREATE TABLE app_settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  value       MEDIUMTEXT NOT NULL,
  updated_by  CHAR(36) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
