-- Technique bank. Run by hand in phpMyAdmin AFTER the structured-workout-plan
-- tables (workout_plan_days / workout_plan_exercises) exist and BEFORE the
-- backend deploy. Do not re-import schema.sql.

CREATE TABLE techniques (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  coach_id    CHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_techniques_coach_name (coach_id, name),
  CONSTRAINT fk_techniques_coach FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE workout_plan_exercises
  ADD COLUMN technique_id CHAR(36) NULL AFTER note,
  ADD CONSTRAINT fk_wpe_technique FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE SET NULL;
