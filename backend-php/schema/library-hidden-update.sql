-- Lets the platform admin hide a library entry (exercise, food, supplement)
-- from trainers' lists and pickers without deleting it — plans that already
-- use it keep showing it.
-- Run in phpMyAdmin -> SQL, after taking a backup, BEFORE deploying the backend.
-- Running it twice errors on "Duplicate column name" and changes nothing.
-- Do NOT re-import schema.sql.

ALTER TABLE exercises   ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE foods       ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE supplements ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0;
