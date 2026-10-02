-- Phase 5, part B: the column for an athlete's membership level in a club
-- (elite / basic / daily, on memberships and invitations) is renamed from
-- plan_tier to membership_level. It never had anything to do with the
-- platform's subscription plans; only the name changes, not the values or
-- the data. Safe to run twice: IF EXISTS skips a column already renamed.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE memberships RENAME COLUMN IF EXISTS plan_tier TO membership_level;

ALTER TABLE invitations RENAME COLUMN IF EXISTS plan_tier TO membership_level;
