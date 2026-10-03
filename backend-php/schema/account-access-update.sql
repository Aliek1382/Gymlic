-- Access set by hand for one trainer or one club, whatever their plan says:
-- a fixed tier, sections switched on or off one by one, and (trainers) the
-- custom exercise / template / plan history / report caps. Kept until the
-- admin clears it; a plan change doesn't touch it. Each row goes with its
-- trainer or club (and comes back with it from the recycle bin).
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE trainer_access (
  trainer_id CHAR(36) NOT NULL PRIMARY KEY,
  tier       VARCHAR(20) NULL,
  features   TEXT NULL,
  limits     TEXT NULL,
  note       VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainer_access_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_trainer_access_admin FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE club_access (
  club_id    CHAR(36) NOT NULL PRIMARY KEY,
  tier       VARCHAR(20) NULL,
  features   TEXT NULL,
  limits     TEXT NULL,
  note       VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_club_access_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_club_access_admin FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
