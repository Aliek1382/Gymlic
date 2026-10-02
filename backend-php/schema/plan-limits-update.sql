-- Plan limits, phase 1: what each club and trainer plan allows, the seven
-- plans the site starts selling, a grace period after a subscription ends,
-- and an admin override of a cap on one subscription.
--   * plans (clubs) gain a trainer cap; trainer_plans gain a free flag. Both
--     gain the columns the later phases read (custom exercises, templates,
--     history, reports): filled now, not checked yet. NULL = unlimited.
--   * subscriptions / trainer_subscriptions point at their plan, so the caps
--     are read from the plan and an edit of the plan reaches everyone on it.
--     A trainer on the free plan may have no row at all; a row on the free
--     plan has no expiry (NULL).
--   * trainer_athletes.suspended_by_plan: an athlete above the cap once a
--     trainer's paid plan has ended (after the grace days). Nothing is
--     deleted, and renewing brings everyone back.
--   * The plans sold until now are switched off (not deleted: old payments
--     point at them) and the seven new ones added.
-- Needs trainer-billing-update.sql and trainer-billing-extras-update.sql
-- first. Nothing is enforced until the admin switches on "الزام اشتراک مربی"
-- in the billing settings.
-- Run it from the admin panel (Database updates), or in phpMyAdmin -> SQL
-- after taking a backup. Do NOT re-import schema.sql.

ALTER TABLE plans
  ADD COLUMN max_trainers         INT NULL AFTER max_members,
  ADD COLUMN max_custom_exercises INT NULL AFTER max_trainers,
  ADD COLUMN max_templates        INT NULL AFTER max_custom_exercises,
  ADD COLUMN history_months       INT NULL AFTER max_templates,
  ADD COLUMN report_level         ENUM('count','basic','full','full_excel') NULL AFTER history_months;

ALTER TABLE trainer_plans
  ADD COLUMN is_free              TINYINT(1) NOT NULL DEFAULT 0 AFTER max_athletes,
  ADD COLUMN max_custom_exercises INT NULL AFTER is_free,
  ADD COLUMN max_templates        INT NULL AFTER max_custom_exercises,
  ADD COLUMN history_months       INT NULL AFTER max_templates,
  ADD COLUMN report_level         ENUM('count','basic','full','full_excel') NULL AFTER history_months;

ALTER TABLE subscriptions
  ADD COLUMN plan_id               CHAR(36) NULL AFTER club_id,
  ADD COLUMN override_on           TINYINT(1) NOT NULL DEFAULT 0 AFTER expires_at,
  ADD COLUMN override_max_members  INT NULL AFTER override_on,
  ADD COLUMN override_max_trainers INT NULL AFTER override_max_members,
  ADD CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;

ALTER TABLE subscriptions
  MODIFY status ENUM('active','expiring','grace','expired') NOT NULL DEFAULT 'active';

ALTER TABLE trainer_subscriptions
  ADD COLUMN plan_id               CHAR(36) NULL AFTER trainer_id,
  ADD COLUMN override_on           TINYINT(1) NOT NULL DEFAULT 0 AFTER reminder_stage,
  ADD COLUMN override_max_athletes INT NULL AFTER override_on,
  ADD COLUMN downgrade_applied_at  DATETIME NULL AFTER override_max_athletes,
  ADD CONSTRAINT fk_tsub_plan FOREIGN KEY (plan_id) REFERENCES trainer_plans(id) ON DELETE SET NULL;

ALTER TABLE trainer_subscriptions
  MODIFY expires_at DATETIME NULL;

ALTER TABLE trainer_athletes
  ADD COLUMN suspended_by_plan TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN keep_on_downgrade TINYINT(1) NOT NULL DEFAULT 0 AFTER suspended_by_plan;

-- The trainer plans. The free one never expires: its duration_days is only
-- there because the column must be positive, and is never read.
INSERT INTO trainer_plans (id, name, price_toman, duration_days, max_athletes, is_free, max_custom_exercises, max_templates, history_months, report_level, is_active)
VALUES ('7a000000-0000-4000-8000-000000000001', 'رایگان', 0, 30, 3, 1, 5, 0, 3, 'count', 1);
INSERT INTO trainer_plans (id, name, price_toman, duration_days, max_athletes, is_free, max_custom_exercises, max_templates, history_months, report_level, is_active)
VALUES ('7a000000-0000-4000-8000-000000000002', 'نقره‌ای', 290000, 30, 15, 0, 30, 5, 12, 'basic', 1);
INSERT INTO trainer_plans (id, name, price_toman, duration_days, max_athletes, is_free, max_custom_exercises, max_templates, history_months, report_level, is_active)
VALUES ('7a000000-0000-4000-8000-000000000003', 'طلایی', 590000, 30, 40, 0, NULL, 20, NULL, 'full', 1);
INSERT INTO trainer_plans (id, name, price_toman, duration_days, max_athletes, is_free, max_custom_exercises, max_templates, history_months, report_level, is_active)
VALUES ('7a000000-0000-4000-8000-000000000004', 'الماسی', 990000, 30, NULL, 0, NULL, NULL, NULL, 'full_excel', 1);

-- The club plans (no free one: a club without a paid plan cannot invite).
INSERT INTO plans (id, name, price_toman, duration_days, max_members, max_trainers, is_active)
VALUES ('7c000000-0000-4000-8000-000000000002', 'نقره‌ای', 990000, 30, 100, 3, 1);
INSERT INTO plans (id, name, price_toman, duration_days, max_members, max_trainers, is_active)
VALUES ('7c000000-0000-4000-8000-000000000003', 'طلایی', 1800000, 30, 300, 8, 1);
INSERT INTO plans (id, name, price_toman, duration_days, max_members, max_trainers, is_active)
VALUES ('7c000000-0000-4000-8000-000000000004', 'الماسی', 2900000, 30, NULL, NULL, 1);

-- Everything sold until now stops being offered.
UPDATE trainer_plans SET is_active = 0 WHERE id NOT LIKE '7a000000-0000-4000-8000-00000000000_';
UPDATE plans SET is_active = 0 WHERE id NOT LIKE '7c000000-0000-4000-8000-00000000000_';
