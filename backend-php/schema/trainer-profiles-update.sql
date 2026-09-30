-- Trainer résumé (bio, achievements, certificate photos, pricing, social links).
-- Run by hand in phpMyAdmin BEFORE the backend deploy. Do not re-import
-- schema.sql. Independent of every other update file.

CREATE TABLE trainer_profiles (
  trainer_id     CHAR(36) NOT NULL PRIMARY KEY,
  bio            TEXT NULL,
  achievements   JSON NULL,   -- array of strings, e.g. ["قهرمان کشوری ۱۴۰۱", "مربی تیم ملی"]
  certificates   JSON NULL,   -- array of image URLs (output of UploadController)
  pricing_table  JSON NULL,   -- array of {"title":"...", "price_toman":..., "description":"..."}
  social_links   JSON NULL,   -- {"instagram":"...", "telegram":"...", "website":"..."}
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainer_profiles_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- One row per trainer; trainer_id is both PK and FK because the relation is one-to-one.
