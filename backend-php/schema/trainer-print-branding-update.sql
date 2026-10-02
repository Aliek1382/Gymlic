-- The trainer's own logo and watermark on a printed or PDF plan («چاپ و PDF
-- برنامه با نام، لوگو و واترمارک شما»). Kept on trainer_profiles beside the
-- résumé; no row means the defaults (profile photo, «جیم‌لیک — name»).
-- Needs trainer-profiles-update.sql first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE trainer_profiles
  ADD COLUMN print_logo_url VARCHAR(1024) NULL AFTER social_links,
  ADD COLUMN print_watermark VARCHAR(80) NULL AFTER print_logo_url;
