-- Trainer's private notes (about one athlete, or general with athlete_id NULL).
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "table already exists" and changes nothing.
-- Do NOT re-import schema.sql.

CREATE TABLE notes (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id CHAR(36) NOT NULL,
  athlete_id CHAR(36) NULL,   -- NULL = یادداشت کلی مربی، بدون ورزشکار خاص
  content    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notes_trainer (trainer_id, created_at DESC),
  KEY idx_notes_athlete (trainer_id, athlete_id, created_at DESC),
  CONSTRAINT fk_notes_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
