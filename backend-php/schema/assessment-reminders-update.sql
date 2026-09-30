-- Periodic "measure again" reminders, set by a trainer per athlete.
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "table already exists" and changes nothing.
-- Do NOT re-import schema.sql.

CREATE TABLE assessment_reminders (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id       CHAR(36) NOT NULL,
  athlete_id       CHAR(36) NOT NULL,
  interval_weeks   INT NOT NULL DEFAULT 4,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  last_reminded_at DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ar_trainer_athlete (trainer_id, athlete_id),
  CONSTRAINT fk_ar_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_ar_interval CHECK (interval_weeks > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
