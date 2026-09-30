-- Chat media messages + one-sided conversation archive.
-- Run in phpMyAdmin -> SQL, after taking a backup. Both statements run once:
-- the ALTER errors on "duplicate column" and the CREATE on "table already
-- exists" if repeated, and changes nothing. Do NOT re-import schema.sql.

ALTER TABLE messages
  MODIFY COLUMN body VARCHAR(1000) NULL,
  ADD COLUMN type       ENUM('text','voice','image','video','file') NOT NULL DEFAULT 'text' AFTER body,
  ADD COLUMN media_url  VARCHAR(1024) NULL AFTER type,
  ADD COLUMN media_name VARCHAR(255) NULL AFTER media_url;   -- نام اصلی فایل، برای نوع 'file'
-- body دیگر NOT NULL نیست چون پیام غیرمتنی می‌تواند body خالی داشته باشد؛ اعتبارسنجی
-- «body یا media_url، بسته به type، باید پر باشد» در بک‌اند انجام می‌شود، نه در دیتابیس.

CREATE TABLE conversation_archives (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  user_id        CHAR(36) NOT NULL,
  counterpart_id CHAR(36) NOT NULL,
  archived_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ca_pair (user_id, counterpart_id),
  CONSTRAINT fk_ca_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_counterpart FOREIGN KEY (counterpart_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- یک‌طرفه است: مربی می‌تواند مکالمه با ورزشکار X را برای خودش آرشیو کند بدون این‌که برای همان
-- ورزشکار هم آرشیو شده باشد — دقیقاً مثل آرشیو ایمیل، نه بستن دوطرفهٔ گفتگو.
