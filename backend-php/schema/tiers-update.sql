-- Phase 10, part 2: free / silver / gold / diamond tiers. Every club plan and
-- trainer plan gets a tier, and a subscription takes its plan's tier when it
-- is bought, approved or renewed. Which panel sections each tier opens is set
-- in the admin panel (Plan tiers); until then every tier opens everything,
-- and a subscription with no tier yet is never limited.
-- Needs the trainer subscription update (trainer-billing-update.sql) first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE plans
  ADD COLUMN tier VARCHAR(20) NULL AFTER max_members;

ALTER TABLE subscriptions
  ADD COLUMN tier VARCHAR(20) NULL AFTER plan_name;

ALTER TABLE trainer_plans
  ADD COLUMN tier VARCHAR(20) NULL AFTER max_athletes;

ALTER TABLE trainer_subscriptions
  ADD COLUMN tier VARCHAR(20) NULL AFTER plan_name;
