-- Phase 9: the admin's growth dashboard and "view the panel as this user".
--  * daily_active: one row per user per day they used the panel, for the
--    daily/weekly active-user charts (written by Auth::currentUser).
--  * sessions.impersonated_by / read_only: a read-only session a super admin
--    opens to see a user's panel exactly as they see it, for support.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE daily_active (
  day     DATE     NOT NULL,
  user_id CHAR(36) NOT NULL,
  PRIMARY KEY (day, user_id),
  KEY idx_daily_active_user (user_id),
  CONSTRAINT fk_daily_active_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE sessions
  ADD COLUMN impersonated_by CHAR(36) NULL AFTER ip_address,
  ADD COLUMN read_only TINYINT(1) NOT NULL DEFAULT 0 AFTER impersonated_by;

ALTER TABLE sessions
  ADD CONSTRAINT fk_sessions_impersonator FOREIGN KEY (impersonated_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- The days already known, so the charts don't start empty: the days of the
-- logins still on record.
INSERT IGNORE INTO daily_active (day, user_id)
  SELECT DISTINCT DATE(created_at), user_id FROM sessions;
