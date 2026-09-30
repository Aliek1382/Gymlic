-- Coach points (gamification): per-action rules + an append-only log.
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "table already exists" and changes nothing.
-- Do NOT re-import schema.sql.

CREATE TABLE point_rules (
  action_type VARCHAR(50) NOT NULL PRIMARY KEY,
  label       VARCHAR(255) NOT NULL,
  points      INT NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT chk_point_rules_points CHECK (points > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO point_rules (action_type, label, points) VALUES
  ('workout_plan_created', 'ساخت برنامهٔ تمرینی', 5),
  ('nutrition_plan_created', 'ساخت برنامهٔ غذایی', 5),
  ('athlete_added', 'افزودن ورزشکار جدید', 10),
  ('ticket_answered', 'پاسخ به تیکت', 3);

CREATE TABLE coach_point_logs (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  coach_id    CHAR(36) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  points      INT NOT NULL,  -- copied from point_rules at award time, not a live reference
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cpl_coach (coach_id, created_at DESC),
  CONSTRAINT fk_cpl_coach FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
