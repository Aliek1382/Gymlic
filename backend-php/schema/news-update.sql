-- News: articles the platform admin publishes from the panel, plus the articles of
-- gymlic.ir (WordPress) that cron/news-fetch.php copies in from its RSS feed.
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "table already exists" and changes nothing.
-- Do NOT re-import schema.sql.

CREATE TABLE news_items (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  origin       ENUM('admin','wordpress') NOT NULL,
  title        VARCHAR(500) NOT NULL,
  summary      TEXT NULL,
  body         MEDIUMTEXT NULL,          -- فقط اخبار ادمین؛ مقالات وردپرس با لینک به سایت باز می‌شوند
  link         VARCHAR(1024) NULL,       -- فقط مقالات وردپرس
  link_hash    CHAR(32) NULL,            -- md5(link): جلوگیری از درج تکراری همان مقاله در هر اجرای کرون
  image_url    VARCHAR(1024) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  published_at DATETIME NOT NULL,
  created_by   CHAR(36) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_news_link_hash (link_hash),
  KEY idx_news_feed (is_published, published_at),
  KEY idx_news_origin (origin, is_published, published_at),
  CONSTRAINT fk_news_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
