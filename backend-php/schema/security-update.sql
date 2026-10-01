-- Phase 5: admin roles with limited permissions, temporary lockout after
-- failed logins, and SMS codes for two-step admin login.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

CREATE TABLE admin_roles (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  permissions TEXT NOT NULL,           -- JSON array of permission keys (src/AdminAccess.php)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE profiles
  ADD COLUMN admin_role_id CHAR(36) NULL AFTER is_platform_admin,
  ADD CONSTRAINT fk_profiles_admin_role FOREIGN KEY (admin_role_id) REFERENCES admin_roles(id) ON DELETE SET NULL;

CREATE TABLE login_attempts (
  id         BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NULL,
  success    TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_attempts_email (email, created_at),
  KEY idx_login_attempts_ip (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE login_challenges (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  user_id      CHAR(36) NOT NULL,
  purpose      ENUM('login','enable_2fa') NOT NULL,
  code_hash    VARCHAR(255) NOT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  expires_at   DATETIME NOT NULL,
  last_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_challenges_user (user_id),
  CONSTRAINT fk_login_challenges_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
