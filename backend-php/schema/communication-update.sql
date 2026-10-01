-- Phase 7: admin broadcasts with an audience, schedule and channels; support
-- tickets from users to the platform admin; editable text pages (terms,
-- privacy, FAQ, help); and when each user was last seen.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE broadcasts (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NULL,
  link            VARCHAR(500) NULL,
  audience        TEXT NOT NULL,                -- JSON: roles, club_ids, inactive_days
  channels        TEXT NOT NULL,                -- JSON: sms / email = off | opted | all
  status          ENUM('scheduled','sending','sent','cancelled','failed') NOT NULL DEFAULT 'scheduled',
  scheduled_at    DATETIME NULL,                -- NULL = sent right away
  sent_at         DATETIME NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  sms_count       INT NOT NULL DEFAULT 0,
  email_count     INT NOT NULL DEFAULT 0,
  error           VARCHAR(500) NULL,
  created_by      CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_broadcasts_due (status, scheduled_at),
  KEY idx_broadcasts_created (created_at),
  CONSTRAINT fk_broadcasts_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE support_tickets (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  ticket_number BIGINT NOT NULL AUTO_INCREMENT,
  user_id       CHAR(36) NOT NULL,
  category      ENUM('bug','billing','account','suggestion','other') NOT NULL DEFAULT 'other',
  subject       VARCHAR(255) NOT NULL,
  status        ENUM('open','answered','closed') NOT NULL DEFAULT 'open',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at     DATETIME NULL,
  UNIQUE KEY uq_support_tickets_number (ticket_number),
  KEY idx_support_tickets_status (status, updated_at),
  KEY idx_support_tickets_user (user_id, updated_at),
  CONSTRAINT fk_support_tickets_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1000;

CREATE TABLE support_messages (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  seq        BIGINT NOT NULL AUTO_INCREMENT,  -- conversation order (created_at is per second)
  ticket_id  CHAR(36) NOT NULL,
  sender_id  CHAR(36) NULL,
  from_admin TINYINT(1) NOT NULL DEFAULT 0,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_support_messages_seq (seq),
  KEY idx_support_messages_ticket (ticket_id, seq),
  CONSTRAINT fk_support_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_support_messages_sender FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_pages (
  slug         VARCHAR(60) NOT NULL PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  body         MEDIUMTEXT NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  sort_order   INT NOT NULL DEFAULT 0,
  updated_by   CHAR(36) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_site_pages_editor FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO site_pages (slug, title, body, is_published, sort_order) VALUES
  ('terms', 'قوانین و مقررات', '', 0, 1),
  ('privacy', 'حریم خصوصی', '', 0, 2),
  ('faq', 'سؤالات متداول', '', 0, 3),
  ('help', 'راهنما', '', 0, 4);

ALTER TABLE profiles
  ADD COLUMN last_seen_at DATETIME NULL AFTER notify_email,
  ADD KEY idx_profiles_last_seen (last_seen_at);
