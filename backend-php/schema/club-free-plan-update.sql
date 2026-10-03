-- A free plan for clubs, like the trainers' one: a club without a paid plan
-- (never bought, or ended and past its grace days) is on it, and can invite
-- up to its caps. Clubs no longer wait for an admin's approval: they start
-- on this plan the moment they sign up, and the ones still waiting are let in.
-- Needs plan-limits-update.sql first.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE plans
  ADD COLUMN is_free TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

INSERT IGNORE INTO plans (id, name, price_toman, duration_days, max_members, max_trainers, tier, is_active, is_free)
VALUES ('7c000000-0000-4000-8000-000000000001', 'رایگان', 0, 30, 20, 1, 'free', 1, 1);

UPDATE plans SET is_free = 1, is_active = 1, price_toman = 0
WHERE id = '7c000000-0000-4000-8000-000000000001';

UPDATE clubs SET status = 'active' WHERE status = 'pending';
