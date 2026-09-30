-- SMS / email copies of notifications. Run by hand in phpMyAdmin BEFORE the
-- backend deploy. Do not re-import schema.sql.

ALTER TABLE profiles
  ADD COLUMN notify_sms   TINYINT(1) NOT NULL DEFAULT 0 AFTER is_suspended,
  ADD COLUMN notify_email TINYINT(1) NOT NULL DEFAULT 0 AFTER notify_sms;

CREATE TABLE notification_deliveries (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  notification_id CHAR(36) NOT NULL,
  channel         ENUM('sms','email') NOT NULL,
  status          ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts        INT NOT NULL DEFAULT 0,
  last_error      VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME NULL,
  KEY idx_nd_status (status, created_at),
  KEY idx_nd_notification (notification_id),
  CONSTRAINT fk_nd_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
