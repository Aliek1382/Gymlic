-- Gymlic MySQL schema (PHP backend rewrite, replaces Supabase/Postgres)
-- Target: MySQL 8.0+ / MariaDB 10.4+ on typical Iranian shared hosting (utf8mb4, InnoDB).
-- uuid -> CHAR(36) app-generated (PHP: random_bytes-based uuid v4), timestamptz -> DATETIME (UTC),
-- jsonb -> JSON, numeric -> DECIMAL, arrays -> not needed (none persisted as columns).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================================
-- profiles: merges Supabase auth.users + public.profiles (no separate auth table in MySQL)
-- =========================================================================
CREATE TABLE profiles (
  id                 CHAR(36)     NOT NULL PRIMARY KEY,
  phone              VARCHAR(32)  NULL,
  email              VARCHAR(255) NULL,
  password_hash      VARCHAR(255) NOT NULL,
  first_name         VARCHAR(255) NULL,
  last_name          VARCHAR(255) NULL,
  avatar_url         VARCHAR(1024) NULL,
  account_type       ENUM('club','trainer','athlete') NULL,
  birth_date         DATE NULL,
  -- Athletes only. The three percentages are all set (and add up to 100) or
  -- all NULL; that rule lives in ProfileController, not a CHECK, because they
  -- are three separate columns.
  daily_calorie_goal INT NULL,
  protein_percent    TINYINT NULL,
  carbs_percent      TINYINT NULL,
  fat_percent        TINYINT NULL,
  is_platform_admin  TINYINT(1) NOT NULL DEFAULT 0,
  admin_role_id      CHAR(36) NULL,  -- a limited admin role (admin_roles); FK added at the end of this file
  is_suspended       TINYINT(1) NOT NULL DEFAULT 0,
  notify_sms         TINYINT(1) NOT NULL DEFAULT 0,   -- opt-in: also send notifications by SMS
  notify_email       TINYINT(1) NOT NULL DEFAULT 0,   -- opt-in: also send notifications by email
  last_seen_at       DATETIME NULL,                   -- last request, at most hourly (Auth::currentUser)
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profiles_phone (phone),
  UNIQUE KEY uq_profiles_email (email),
  KEY idx_profiles_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- clubs
-- =========================================================================
CREATE TABLE clubs (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  logo_url        VARCHAR(1024) NULL,
  owner_id        CHAR(36) NOT NULL,
  status          ENUM('active','suspended','pending') NOT NULL DEFAULT 'active',
  member_capacity INT NULL,
  address         VARCHAR(500) NULL,
  phone           VARCHAR(32) NULL,
  working_hours   VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_clubs_owner (owner_id),
  CONSTRAINT fk_clubs_owner FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- club_membership_plans (club-defined membership tiers)
-- =========================================================================
CREATE TABLE club_membership_plans (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  club_id       CHAR(36) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  price_toman   BIGINT NOT NULL DEFAULT 0,
  duration_days INT NOT NULL DEFAULT 30,
  description   TEXT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cmp_club_sort (club_id, sort_order),
  CONSTRAINT fk_cmp_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT chk_cmp_price CHECK (price_toman >= 0),
  CONSTRAINT chk_cmp_duration CHECK (duration_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- memberships
-- =========================================================================
CREATE TABLE memberships (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  club_id    CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  role       ENUM('owner','trainer','reception','athlete') NOT NULL,
  status     ENUM('active','pending','suspended') NOT NULL DEFAULT 'active',
  membership_level ENUM('elite','basic','daily') NOT NULL DEFAULT 'basic',
  plan_id    CHAR(36) NULL,
  expires_at DATE NULL,
  joined_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_membership (club_id, user_id),
  KEY idx_membership_club (club_id),
  KEY idx_membership_user (user_id),
  KEY idx_membership_dashboard (club_id, role, status, joined_at),
  KEY idx_membership_expiry (club_id, expires_at),
  KEY idx_membership_plan (plan_id),
  CONSTRAINT fk_membership_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_plan FOREIGN KEY (plan_id) REFERENCES club_membership_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- trainer_athletes
-- =========================================================================
CREATE TABLE trainer_athletes (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id CHAR(36) NOT NULL,
  athlete_id CHAR(36) NOT NULL,
  club_id    CHAR(36) NULL,
  status     ENUM('active','pending','suspended') NOT NULL DEFAULT 'active',
  -- Above the cap of a trainer whose paid plan ended (after the grace days):
  -- their data is read-only, no new plans or messages. See Limits.
  suspended_by_plan TINYINT(1) NOT NULL DEFAULT 0,
  keep_on_downgrade TINYINT(1) NOT NULL DEFAULT 0,  -- the trainer's pick of who stays active
  note       TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trainer_athlete (trainer_id, athlete_id),
  KEY idx_ta_trainer (trainer_id),
  KEY idx_ta_athlete (athlete_id),
  CONSTRAINT fk_ta_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- invitations
-- =========================================================================
CREATE TABLE invitations (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  code         VARCHAR(64) NOT NULL,
  club_id      CHAR(36) NULL,
  trainer_id   CHAR(36) NULL,
  invited_role ENUM('trainer','reception','athlete') NOT NULL,
  phone        VARCHAR(32) NULL,
  status       ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
  created_by   CHAR(36) NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,
  accepted_by  CHAR(36) NULL,
  accepted_at  DATETIME NULL,
  first_name   VARCHAR(255) NULL,
  last_name    VARCHAR(255) NULL,
  height_cm    DECIMAL(5,1) NULL,
  weight_kg    DECIMAL(5,1) NULL,
  membership_level ENUM('elite','basic','daily') NULL,
  plan_id      CHAR(36) NULL,
  UNIQUE KEY uq_invitation_code (code),
  KEY idx_invitation_club (club_id),
  CONSTRAINT fk_invitation_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_creator FOREIGN KEY (created_by) REFERENCES profiles(id),
  CONSTRAINT fk_invitation_acceptor FOREIGN KEY (accepted_by) REFERENCES profiles(id),
  CONSTRAINT fk_invitation_plan FOREIGN KEY (plan_id) REFERENCES club_membership_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- plans (platform subscription catalog) — must precede subscriptions/payment_requests
-- =========================================================================
CREATE TABLE plans (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  price_toman   BIGINT NOT NULL,
  duration_days INT NOT NULL,
  max_members   INT NULL,
  tier          VARCHAR(20) NULL,   -- free | silver | gold | diamond (Tiers); NULL = not set
  max_trainers  INT NULL,
  -- Read by later phases; NULL = unlimited, like the caps.
  max_custom_exercises INT NULL,
  max_templates        INT NULL,
  history_months       INT NULL,
  report_level         ENUM('count','basic','full','full_excel') NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  is_free       TINYINT(1) NOT NULL DEFAULT 0,   -- the free club plan (club-free-plan-update.sql)
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_plans_price CHECK (price_toman >= 0),
  CONSTRAINT chk_plans_duration CHECK (duration_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- subscriptions (platform billing per club)
-- =========================================================================
CREATE TABLE subscriptions (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  club_id    CHAR(36) NOT NULL,
  plan_id    CHAR(36) NULL,
  plan_name  VARCHAR(255) NOT NULL,
  tier       VARCHAR(20) NULL,      -- the plan's tier when bought; NULL = not limited by tier
  status     ENUM('active','expiring','grace','expired') NOT NULL DEFAULT 'active',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  -- An admin's caps for this subscription instead of the plan's (NULL = no
  -- cap); cleared when the plan changes, ignored once the grace days end.
  override_on           TINYINT(1) NOT NULL DEFAULT 0,
  override_max_members  INT NULL,
  override_max_trainers INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_subscriptions_club (club_id),
  CONSTRAINT fk_subscriptions_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- payment_requests
-- =========================================================================
CREATE TABLE payment_requests (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  club_id        CHAR(36) NOT NULL,
  plan_id        CHAR(36) NOT NULL,
  purchase_kind  VARCHAR(10) NULL,     -- new | renew | upgrade | switch (PlanChange)
  from_plan_id   CHAR(36) NULL,        -- an upgrade: the plan it replaced
  from_price_toman BIGINT NULL,        -- and that plan's price then
  submitted_by   CHAR(36) NOT NULL,
  amount_toman   BIGINT NOT NULL,
  reference_note TEXT NULL,
  tracking_code      VARCHAR(40)  NULL,  -- bank tracking number the club typed
  card_last4         CHAR(4)      NULL,  -- last four digits of the paying card
  paid_at            DATETIME     NULL,  -- optional: when the transfer was made
  receipt_path       VARCHAR(120) NULL,  -- file under uploads/receipts/, NULL once purged
  receipt_purged_at  DATETIME     NULL,
  discount_code_id CHAR(36) NULL,  -- discount_codes; FK added at the end of this file
  list_price_toman BIGINT NULL,    -- the plan's price when a discount code was used
  discount_toman   BIGINT NOT NULL DEFAULT 0,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note     TEXT NULL,
  reviewed_by    CHAR(36) NULL,
  reviewed_at    DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reminded_at    DATETIME NULL,          -- the "waiting for review" reminder was sent
  KEY idx_payreq_club (club_id, created_at DESC),
  KEY idx_payreq_status (status),
  KEY idx_payreq_tracking (tracking_code),
  CONSTRAINT fk_payreq_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_payreq_plan FOREIGN KEY (plan_id) REFERENCES plans(id),
  CONSTRAINT fk_payreq_submitter FOREIGN KEY (submitted_by) REFERENCES profiles(id),
  CONSTRAINT fk_payreq_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id),
  CONSTRAINT chk_payreq_amount CHECK (amount_toman >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- workout_assignments / nutrition_assignments (identical shape)
-- =========================================================================
CREATE TABLE workout_assignments (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  club_id        CHAR(36) NULL,
  trainer_id     CHAR(36) NOT NULL,
  athlete_id     CHAR(36) NULL,
  invitation_id  CHAR(36) NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  status         ENUM('active','completed','cancelled','draft') NOT NULL DEFAULT 'active',
  is_template    TINYINT(1) NOT NULL DEFAULT 0,
  is_public      TINYINT(1) NOT NULL DEFAULT 0,  -- a template the admin offers every trainer (is_template = 1)
  -- 'structured' once a trainer builds this plan from workout_plan_days
  -- instead of typing description free-text; the two are never mixed on one
  -- assignment (see workout_plan_days below).
  builder_mode   ENUM('text','structured') NOT NULL DEFAULT 'text',
  assigned_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_wa_club (club_id),
  KEY idx_wa_trainer (trainer_id),
  KEY idx_wa_athlete (athlete_id),
  KEY idx_wa_invitation (invitation_id),
  KEY idx_wa_dashboard (trainer_id, is_template, status, assigned_at),
  CONSTRAINT fk_wa_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_wa_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_wa_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_wa_invitation FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE nutrition_assignments (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  club_id        CHAR(36) NULL,
  trainer_id     CHAR(36) NOT NULL,
  athlete_id     CHAR(36) NULL,
  invitation_id  CHAR(36) NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT NULL,
  status         ENUM('active','completed','cancelled','draft') NOT NULL DEFAULT 'active',
  is_template    TINYINT(1) NOT NULL DEFAULT 0,
  is_public      TINYINT(1) NOT NULL DEFAULT 0,  -- a template the admin offers every trainer (is_template = 1)
  assigned_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_na_club (club_id),
  KEY idx_na_trainer (trainer_id),
  KEY idx_na_athlete (athlete_id),
  KEY idx_na_invitation (invitation_id),
  KEY idx_na_dashboard (trainer_id, is_template, status, assigned_at),
  CONSTRAINT fk_na_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_na_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_na_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_na_invitation FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- workout_day_logs
-- =========================================================================
CREATE TABLE workout_day_logs (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  assignment_id CHAR(36) NOT NULL,
  athlete_id    CHAR(36) NOT NULL,
  day_key       VARCHAR(255) NOT NULL,
  completed_on  DATE NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workout_day_log (assignment_id, day_key, completed_on),
  KEY idx_wdl_athlete (athlete_id, completed_on),
  CONSTRAINT fk_wdl_assignment FOREIGN KEY (assignment_id) REFERENCES workout_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_wdl_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- measurements
-- =========================================================================
CREATE TABLE measurements (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  athlete_id        CHAR(36) NOT NULL,
  recorded_by       CHAR(36) NULL,
  height_cm         DECIMAL(5,1) NULL,
  weight_kg         DECIMAL(5,1) NULL,
  body_fat_percent  DECIMAL(4,1) NULL,
  waist_cm          DECIMAL(5,1) NULL,
  chest_cm          DECIMAL(5,1) NULL,
  note              TEXT NULL,
  recorded_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_measurements_athlete (athlete_id, recorded_at DESC),
  CONSTRAINT fk_measurements_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_measurements_recorder FOREIGN KEY (recorded_by) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- activity_logs
-- =========================================================================
CREATE TABLE activity_logs (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  club_id    CHAR(36) NULL,
  actor_id   CHAR(36) NULL,
  subject_id CHAR(36) NULL,
  action     VARCHAR(100) NOT NULL,
  metadata   JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_club (club_id, created_at DESC),
  CONSTRAINT fk_activity_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES profiles(id),
  CONSTRAINT fk_activity_subject FOREIGN KEY (subject_id) REFERENCES profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- revenue_entries
-- =========================================================================
CREATE TABLE revenue_entries (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  club_id     CHAR(36) NOT NULL,
  amount      DECIMAL(14,0) NOT NULL,
  member_id   CHAR(36) NULL,
  category    ENUM('membership','session','product','other') NOT NULL DEFAULT 'membership',
  note        TEXT NULL,
  recorded_by CHAR(36) NULL,
  occurred_at DATE NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_revenue_club (club_id, occurred_at DESC),
  KEY idx_revenue_member (member_id),
  CONSTRAINT fk_revenue_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_revenue_member FOREIGN KEY (member_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT fk_revenue_recorder FOREIGN KEY (recorded_by) REFERENCES profiles(id),
  CONSTRAINT chk_revenue_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- class_attendance_logs
-- =========================================================================
CREATE TABLE class_attendance_logs (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  club_id    CHAR(36) NOT NULL,
  member_id  CHAR(36) NOT NULL,
  attended   TINYINT(1) NOT NULL DEFAULT 1,
  class_date DATE NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attendance_club (club_id, class_date DESC),
  CONSTRAINT fk_attendance_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_member FOREIGN KEY (member_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- exercises / exercise_usage
-- =========================================================================
CREATE TABLE exercises (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  name_en       VARCHAR(255) NULL,
  description   TEXT NULL,
  image_url     VARCHAR(1024) NULL,  -- how-to image / GIF, set by the admin
  video_url     VARCHAR(1024) NULL,  -- uploaded video or an Aparat / YouTube link
  muscle_group  VARCHAR(100) NOT NULL,
  created_by    CHAR(36) NULL,
  is_hidden     TINYINT(1) NOT NULL DEFAULT 0,  -- hidden by the admin from lists/pickers
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exercises_creator (created_by),
  CONSTRAINT fk_exercises_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exercise_usage (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id    CHAR(36) NOT NULL,
  exercise_id   CHAR(36) NOT NULL,
  use_count     INT NOT NULL DEFAULT 0,
  last_used_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exercise_usage (trainer_id, exercise_id),
  KEY idx_exercise_usage_trainer (trainer_id),
  CONSTRAINT fk_exercise_usage_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_exercise_usage_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- workout_plan_days / workout_plan_exercises: the structured builder behind
-- workout_assignments.builder_mode = 'structured'. A structured assignment's
-- description is left as-is (usually NULL) and the trainer/athlete-facing
-- program is read from these tables instead; a 'text' assignment has no rows
-- here at all. The two modes are never mixed on one assignment.
-- =========================================================================
CREATE TABLE workout_plan_days (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  assignment_id CHAR(36) NOT NULL,
  week_number   INT NOT NULL DEFAULT 1,
  day_number    INT NOT NULL,
  day_name      VARCHAR(100) NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_wpd_assignment (assignment_id, week_number, day_number),
  CONSTRAINT fk_wpd_assignment FOREIGN KEY (assignment_id) REFERENCES workout_assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- techniques: a trainer's own named training techniques (drop-set, super-set…)
-- with an explanation the athlete can read from the plan. Always private to the
-- trainer — unlike exercises/foods there is no shared preset row. Must exist
-- before workout_plan_exercises, which points at it.
CREATE TABLE techniques (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  coach_id    CHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_public   TINYINT(1) NOT NULL DEFAULT 0,  -- offered to every trainer to copy (owned by an admin)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_techniques_coach_name (coach_id, name),
  CONSTRAINT fk_techniques_coach FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE workout_plan_exercises (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  day_id         CHAR(36) NOT NULL,
  exercise_id    CHAR(36) NOT NULL,
  sets           INT NULL,
  reps           VARCHAR(50) NULL,
  weight_kg      DECIMAL(6,2) NULL,
  rest_seconds   INT NULL,
  note           VARCHAR(500) NULL,
  -- Optional link to the trainer's technique bank; note stays a free extra line.
  technique_id   CHAR(36) NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_wpe_day (day_id, sort_order),
  KEY idx_wpe_exercise (exercise_id),
  CONSTRAINT fk_wpe_day FOREIGN KEY (day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
  CONSTRAINT fk_wpe_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  CONSTRAINT fk_wpe_technique FOREIGN KEY (technique_id) REFERENCES techniques(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- foods / food_usage
-- =========================================================================
CREATE TABLE foods (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  name_en       VARCHAR(255) NULL,
  description   TEXT NULL,
  category      VARCHAR(100) NOT NULL,
  default_unit  VARCHAR(50) NOT NULL,
  -- Per ONE default_unit (default_unit = 'گرم' -> these are per gram, which is
  -- why they carry 4 decimals). NULL = not entered yet: counted as zero in a
  -- plan and flagged in the UI.
  calories_per_unit DECIMAL(9,4) NULL,
  protein_g     DECIMAL(8,4) NULL,
  carbs_g       DECIMAL(8,4) NULL,
  fat_g         DECIMAL(8,4) NULL,
  created_by    CHAR(36) NULL,
  is_hidden     TINYINT(1) NOT NULL DEFAULT 0,  -- hidden by the admin from lists/pickers
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_foods_creator (created_by),
  CONSTRAINT fk_foods_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE food_usage (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id    CHAR(36) NOT NULL,
  food_id       CHAR(36) NOT NULL,
  use_count     INT NOT NULL DEFAULT 0,
  last_used_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_food_usage (trainer_id, food_id),
  KEY idx_food_usage_trainer (trainer_id),
  CONSTRAINT fk_food_usage_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_food_usage_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- nutrition_plan_meals / nutrition_plan_items: the structured builder for
-- nutrition plans. Unlike workout_assignments there is no builder_mode column:
-- a nutrition assignment is 'structured' exactly when it has a meal row here,
-- and 'text' (description only) when it has none. Totals are never stored —
-- the client sums amount x the food's per-unit figures.
-- =========================================================================
CREATE TABLE nutrition_plan_meals (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  assignment_id CHAR(36) NOT NULL,
  meal_name     VARCHAR(100) NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_npm_assignment (assignment_id, sort_order),
  CONSTRAINT fk_npm_assignment FOREIGN KEY (assignment_id) REFERENCES nutrition_assignments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE nutrition_plan_items (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  meal_id    CHAR(36) NOT NULL,
  food_id    CHAR(36) NOT NULL,
  amount     DECIMAL(7,2) NOT NULL,
  unit       VARCHAR(50) NULL,
  note       VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_npi_meal (meal_id, sort_order),
  KEY idx_npi_food (food_id),
  CONSTRAINT fk_npi_meal FOREIGN KEY (meal_id) REFERENCES nutrition_plan_meals(id) ON DELETE CASCADE,
  CONSTRAINT fk_npi_food FOREIGN KEY (food_id) REFERENCES foods(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- notifications
-- =========================================================================
CREATE TABLE notifications (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  recipient_id CHAR(36) NOT NULL,
  actor_id     CHAR(36) NULL,
  type         VARCHAR(50) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NULL,
  link         VARCHAR(500) NULL,
  metadata     JSON NOT NULL,
  read_at      DATETIME NULL,
  pushed_at    DATETIME NULL,            -- when it was sent to the recipient's devices (Web Push)
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_recipient (recipient_id, created_at DESC),
  KEY idx_notifications_push (pushed_at, created_at),
  KEY idx_notifications_unread (recipient_id, read_at),
  KEY idx_notifications_plan_comment (recipient_id, actor_id, type, read_at),
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- notification_deliveries: SMS / email copies of a notification, queued by
-- AuthController::notify and sent by cron/notification-dispatch.php
-- =========================================================================
CREATE TABLE notification_deliveries (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  notification_id CHAR(36) NOT NULL,
  channel         ENUM('sms','email') NOT NULL,
  status          ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  attempts        INT NOT NULL DEFAULT 0,
  last_error      VARCHAR(500) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME NULL,
  KEY idx_nd_status (status, created_at),
  KEY idx_nd_notification (notification_id),
  CONSTRAINT fk_nd_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- messages
-- =========================================================================
CREATE TABLE messages (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  sender_id     CHAR(36) NOT NULL,
  recipient_id  CHAR(36) NOT NULL,
  body          VARCHAR(1000) NULL,
  type          ENUM('text','voice','image','video','file') NOT NULL DEFAULT 'text',
  media_url     VARCHAR(1024) NULL,
  media_name    VARCHAR(255) NULL,
  plan_kind     ENUM('workout','nutrition') NULL,
  plan_id       CHAR(36) NULL,
  read_at       DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_messages_sender (sender_id, recipient_id, created_at),
  KEY idx_messages_recipient (recipient_id, sender_id, created_at),
  KEY idx_messages_unread (recipient_id, sender_id, read_at),
  KEY idx_messages_plan (plan_kind, plan_id, created_at),
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_recipient FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_messages_pair CHECK (sender_id <> recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One-sided, like archiving an email: it hides the thread from this user's
-- main list only. The counterpart's list is untouched.
CREATE TABLE conversation_archives (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  user_id        CHAR(36) NOT NULL,
  counterpart_id CHAR(36) NOT NULL,
  archived_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ca_pair (user_id, counterpart_id),
  CONSTRAINT fk_ca_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ca_counterpart FOREIGN KEY (counterpart_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- trainer_payments
-- =========================================================================
CREATE TABLE trainer_payments (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id   CHAR(36) NOT NULL,
  athlete_id   CHAR(36) NULL,
  amount_toman BIGINT NOT NULL,
  payment_method ENUM('cash','card_transfer','online') NOT NULL DEFAULT 'cash',
  paid_at      DATE NOT NULL,
  note         TEXT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_trainer_payments_trainer (trainer_id, paid_at DESC),
  KEY idx_trainer_payments_athlete (athlete_id),
  CONSTRAINT fk_trainer_payments_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_trainer_payments_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_trainer_payments_amount CHECK (amount_toman > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- invoices: a trainer's bill to one athlete for one plan. A pending invoice
-- locks that plan's content for the athlete until the trainer records the
-- payment. item_id is polymorphic (workout_assignments.id,
-- nutrition_assignments.id, session_packages.id or questionnaire_responses.id),
-- so it carries no FK.
-- =========================================================================
CREATE TABLE invoices (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id     CHAR(36) NOT NULL,
  athlete_id     CHAR(36) NOT NULL,
  item_type      ENUM('workout_plan','nutrition_plan','session_package','questionnaire') NOT NULL,
  item_id        CHAR(36) NOT NULL,   -- workout_assignments.id, nutrition_assignments.id,
                                      -- session_packages.id or questionnaire_responses.id
                                      -- (polymorphic, so no real FK)
  amount_toman   BIGINT NOT NULL,
  status         ENUM('pending','paid','cancelled') NOT NULL DEFAULT 'pending',
  payment_method ENUM('cash','card_transfer','online') NULL,
  note           TEXT NULL,
  paid_at        DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoices_item (item_type, item_id),   -- one invoice row per plan
  KEY idx_invoices_trainer (trainer_id, created_at DESC),
  KEY idx_invoices_athlete (athlete_id, status),
  CONSTRAINT fk_invoices_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_invoices_amount CHECK (amount_toman > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- trainer_payment_info: where an athlete sends a card-to-card payment.
-- invoice_payment_claims: an athlete's "I paid" against a pending invoice. The
-- invoice stays pending (and its plan locked) until the trainer approves one.
-- =========================================================================
CREATE TABLE trainer_payment_info (
  trainer_id  CHAR(36) NOT NULL PRIMARY KEY,
  card_number VARCHAR(19) NULL,
  sheba       VARCHAR(26) NULL,
  holder_name VARCHAR(100) NULL,
  bank_name   VARCHAR(60) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tpi_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE athlete_discount_codes (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id        CHAR(36) NOT NULL,
  code              VARCHAR(40) NOT NULL,
  kind              ENUM('percent','amount') NOT NULL,
  value             BIGINT NOT NULL,
  max_uses          INT NULL,                       -- pending and approved claims count
  once_per_athlete  TINYINT(1) NOT NULL DEFAULT 0,
  expires_at        DATETIME NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  note              VARCHAR(255) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_adc_trainer_code (trainer_id, code),
  CONSTRAINT fk_adc_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_adc_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_payment_claims (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  invoice_id        CHAR(36) NOT NULL,
  athlete_id        CHAR(36) NOT NULL,
  paid_amount_toman BIGINT NULL,            -- what the athlete says they transferred
  discount_code_id  CHAR(36) NULL,
  list_price_toman  BIGINT NULL,                -- the invoice amount when a code was used
  discount_toman    BIGINT NOT NULL DEFAULT 0,
  tracking_code     VARCHAR(40) NOT NULL,
  card_last4        CHAR(4) NOT NULL,
  paid_at           DATETIME NULL,
  note              VARCHAR(500) NULL,
  receipt_path      VARCHAR(120) NULL,   -- file under uploads/receipts/, NULL once purged
  receipt_purged_at DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  trainer_note      VARCHAR(500) NULL,
  reviewed_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reminded_at       DATETIME NULL,
  KEY idx_claims_invoice (invoice_id, created_at DESC),
  KEY idx_claims_status (status),
  KEY idx_claims_tracking (tracking_code),
  CONSTRAINT fk_claims_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_claims_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_claims_discount FOREIGN KEY (discount_code_id) REFERENCES athlete_discount_codes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- trainer_plans / trainer_subscriptions / trainer_payment_requests: a trainer
-- paying the platform card-to-card (the club equivalents are plans,
-- subscriptions and payment_requests). Own catalogue so the club pages are
-- unaffected; enforcement is opt-in from the admin billing settings.
-- =========================================================================
CREATE TABLE trainer_plans (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  price_toman   BIGINT NOT NULL,
  duration_days INT NOT NULL,
  max_athletes  INT NULL,
  is_free       TINYINT(1) NOT NULL DEFAULT 0,   -- the plan every trainer has without paying; never expires
  max_custom_exercises INT NULL,
  max_templates        INT NULL,
  history_months       INT NULL,
  report_level         ENUM('count','basic','full','full_excel') NULL,
  tier          VARCHAR(20) NULL,   -- free | silver | gold | diamond (Tiers); NULL = not set
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_tplans_price CHECK (price_toman >= 0),
  CONSTRAINT chk_tplans_duration CHECK (duration_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trainer_subscriptions (
  trainer_id   CHAR(36) NOT NULL PRIMARY KEY,
  plan_id      CHAR(36) NULL,
  plan_name    VARCHAR(255) NOT NULL,
  tier         VARCHAR(20) NULL,    -- the plan's tier when bought; NULL = not limited by tier
  max_athletes INT NULL,                       -- the plan's cap when bought; the plan's own is what counts
  started_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NULL,                  -- NULL on the free plan
  reminder_stage TINYINT NOT NULL DEFAULT 0,   -- 1 = "ending soon" sent, 2 = "expired" sent, for this expiry
  override_on           TINYINT(1) NOT NULL DEFAULT 0,  -- see subscriptions
  override_max_athletes INT NULL,
  downgrade_applied_at  DATETIME NULL,         -- when the athletes above the free cap were suspended
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tsub_expires (expires_at),
  CONSTRAINT fk_tsub_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_tsub_plan FOREIGN KEY (plan_id) REFERENCES trainer_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trainer_discount_codes (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  code             VARCHAR(40) NOT NULL,             -- stored upper-case, matched case-insensitively
  kind             ENUM('percent','amount') NOT NULL,
  value            BIGINT NOT NULL,                  -- 1..100 for percent, toman for amount
  plan_id          CHAR(36) NULL,                    -- NULL = any trainer plan
  for_trainer_id   CHAR(36) NULL,                    -- NULL = any trainer; else only this one (trainer-discount-owner-update.sql)
  max_uses         INT NULL,                         -- NULL = unlimited, pending and approved requests count
  once_per_trainer TINYINT(1) NOT NULL DEFAULT 0,
  expires_at       DATETIME NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  note             VARCHAR(255) NULL,
  created_by       CHAR(36) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tdiscount_code (code),
  KEY idx_tdiscount_for_trainer (for_trainer_id),
  CONSTRAINT fk_tdiscount_plan FOREIGN KEY (plan_id) REFERENCES trainer_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_tdiscount_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_tdiscount_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trainer_payment_requests (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id        CHAR(36) NOT NULL,
  plan_id           CHAR(36) NOT NULL,
  purchase_kind     VARCHAR(10) NULL,       -- new | renew | upgrade | switch (PlanChange)
  from_plan_id      CHAR(36) NULL,          -- an upgrade: the plan it replaced
  from_price_toman  BIGINT NULL,            -- and that plan's price then
  amount_toman      BIGINT NOT NULL,
  paid_amount_toman BIGINT NULL,            -- what the trainer says they transferred
  discount_code_id  CHAR(36) NULL,
  list_price_toman  BIGINT NULL,                -- the plan's price when a code was used
  discount_toman    BIGINT NOT NULL DEFAULT 0,
  reference_note    VARCHAR(500) NULL,
  tracking_code     VARCHAR(40) NOT NULL,
  card_last4        CHAR(4) NOT NULL,
  paid_at           DATETIME NULL,
  receipt_path      VARCHAR(120) NULL,
  receipt_purged_at DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note        VARCHAR(500) NULL,
  reviewed_by       CHAR(36) NULL,
  reviewed_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reminded_at       DATETIME NULL,
  KEY idx_tpay_trainer (trainer_id, created_at DESC),
  KEY idx_tpay_status (status),
  KEY idx_tpay_tracking (tracking_code),
  CONSTRAINT fk_tpay_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_tpay_plan FOREIGN KEY (plan_id) REFERENCES trainer_plans(id),
  CONSTRAINT fk_tpay_discount FOREIGN KEY (discount_code_id) REFERENCES trainer_discount_codes(id) ON DELETE SET NULL,
  CONSTRAINT fk_tpay_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_tpay_amount CHECK (amount_toman >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- club_payment_info / membership_payment_requests: an athlete paying a club
-- for a membership plan card-to-card. Approving one extends the membership and
-- adds the amount to revenue_entries.
-- =========================================================================
CREATE TABLE club_payment_info (
  club_id     CHAR(36) NOT NULL PRIMARY KEY,
  card_number VARCHAR(19) NULL,
  sheba       VARCHAR(26) NULL,
  holder_name VARCHAR(100) NULL,
  bank_name   VARCHAR(60) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cpi_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE club_discount_codes (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  club_id         CHAR(36) NOT NULL,
  code            VARCHAR(40) NOT NULL,             -- stored upper-case, matched case-insensitively
  kind            ENUM('percent','amount') NOT NULL,
  value           BIGINT NOT NULL,                  -- 1..100 for percent, toman for amount
  plan_id         CHAR(36) NULL,                    -- NULL = any membership plan of the club
  max_uses        INT NULL,                         -- NULL = unlimited, pending and approved payments count
  once_per_member TINYINT(1) NOT NULL DEFAULT 0,
  expires_at      DATETIME NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  note            VARCHAR(255) NULL,
  created_by      CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cdc_club_code (club_id, code),
  CONSTRAINT fk_cdc_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdc_plan FOREIGN KEY (plan_id) REFERENCES club_membership_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_cdc_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_cdc_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE membership_payment_requests (
  id                CHAR(36) NOT NULL PRIMARY KEY,
  club_id           CHAR(36) NOT NULL,
  athlete_id        CHAR(36) NOT NULL,
  plan_id           CHAR(36) NULL,
  plan_name         VARCHAR(255) NOT NULL,
  duration_days     INT NOT NULL,
  amount_toman      BIGINT NOT NULL,
  paid_amount_toman BIGINT NULL,            -- what the athlete says they transferred
  discount_code_id  CHAR(36) NULL,
  list_price_toman  BIGINT NULL,                -- the plan's price when a code was used
  discount_toman    BIGINT NOT NULL DEFAULT 0,
  tracking_code     VARCHAR(40) NOT NULL,
  card_last4        CHAR(4) NOT NULL,
  paid_at           DATETIME NULL,
  note              VARCHAR(500) NULL,
  receipt_path      VARCHAR(120) NULL,
  receipt_purged_at DATETIME NULL,
  status            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  review_note       VARCHAR(500) NULL,
  reviewed_by       CHAR(36) NULL,
  reviewed_at       DATETIME NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reminded_at       DATETIME NULL,
  KEY idx_mpr_club (club_id, status, created_at DESC),
  KEY idx_mpr_athlete (athlete_id, created_at DESC),
  KEY idx_mpr_tracking (tracking_code),
  CONSTRAINT fk_mpr_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_mpr_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mpr_discount FOREIGN KEY (discount_code_id) REFERENCES club_discount_codes(id) ON DELETE SET NULL,
  CONSTRAINT fk_mpr_plan FOREIGN KEY (plan_id) REFERENCES club_membership_plans(id) ON DELETE SET NULL,
  CONSTRAINT fk_mpr_reviewer FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_mpr_amount CHECK (amount_toman > 0),
  CONSTRAINT chk_mpr_duration CHECK (duration_days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- session_packages: a block of N private sessions a trainer sells one athlete.
-- Selling it issues an invoice; settling that invoice flips it to 'active' and
-- creates its package_sessions rows. Unrelated to class_attendance_logs (a
-- club's class attendance).
-- =========================================================================
CREATE TABLE session_packages (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id      CHAR(36) NOT NULL,
  athlete_id      CHAR(36) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  total_sessions  INT NOT NULL,
  price_toman     BIGINT NOT NULL,
  discount_toman  BIGINT NOT NULL DEFAULT 0,
  status          ENUM('pending_payment','active','completed','cancelled') NOT NULL DEFAULT 'pending_payment',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sp_trainer (trainer_id, created_at DESC),
  KEY idx_sp_athlete (athlete_id, status),
  CONSTRAINT fk_sp_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_sp_total CHECK (total_sessions > 0),
  CONSTRAINT chk_sp_price CHECK (price_toman >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- package_sessions: one row per session of a package. Named so it can't be
-- confused with `sessions` below (login tokens). scheduled_at stays NULL until
-- the trainer plans it, and is the column a future calendar reads.
-- =========================================================================
CREATE TABLE package_sessions (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  package_id   CHAR(36) NOT NULL,
  scheduled_at DATETIME NULL,
  status       ENUM('unscheduled','scheduled','done','canceled') NOT NULL DEFAULT 'unscheduled',
  note         VARCHAR(500) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_package_sessions_package (package_id, scheduled_at),
  CONSTRAINT fk_package_sessions_package FOREIGN KEY (package_id) REFERENCES session_packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- calendar_events: the trainer's month calendar. 'manual' rows are typed in;
-- 'auto' rows mirror a dated package_sessions row (source_type = 'session',
-- source_id = package_sessions.id — a logical reference, no FK) and are kept
-- in step by CalendarController::syncSessionEvent. recurrence_rule is PHP
-- weekday numbers, 0 = Sunday ("1,3,5"); it is expanded per request, not stored.
-- =========================================================================
CREATE TABLE calendar_events (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id       CHAR(36) NOT NULL,
  athlete_id       CHAR(36) NULL,
  title            VARCHAR(255) NOT NULL,
  notes            TEXT NULL,
  event_date       DATE NOT NULL,
  start_time       TIME NULL,
  remind_before_minutes INT NULL,        -- 10/30/60/1440; needs start_time
  last_reminded_on DATE NULL,            -- last occurrence a reminder was sent for
  recurrence_rule  VARCHAR(100) NULL,
  recurrence_until DATE NULL,
  source           ENUM('auto','manual') NOT NULL DEFAULT 'manual',
  source_type      VARCHAR(50) NULL,
  source_id        CHAR(36) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ce_trainer_date (trainer_id, event_date),
  KEY idx_ce_source (source_type, source_id),
  CONSTRAINT fk_ce_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- push_subscriptions: one row per browser/device a user enabled notifications
-- on (Web Push). Keyed by endpoint so one browser belongs to one account.
-- push_vapid_keys: the server's single VAPID key pair (id = 1), generated on
-- first use by WebPush::vapidKeys(). Never replace it: a new key orphans every
-- subscription.
-- =========================================================================
CREATE TABLE push_subscriptions (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  user_id       CHAR(36) NOT NULL,
  endpoint      TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  p256dh        VARCHAR(255) NOT NULL,
  auth          VARCHAR(64) NOT NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE push_vapid_keys (
  id          TINYINT NOT NULL PRIMARY KEY,
  private_pem TEXT NOT NULL,
  public_key  VARCHAR(128) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- supplements / supplement_usage / supplement_assignments / supplement_plan_items
-- =========================================================================
CREATE TABLE supplements (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  name_en     VARCHAR(255) NULL,
  description TEXT NULL,
  image_url   VARCHAR(1024) NULL,
  created_by  CHAR(36) NULL,   -- NULL = بانک عمومی، پر = اختصاصی همان مربی (دقیقاً مثل exercises/foods)
  is_hidden   TINYINT(1) NOT NULL DEFAULT 0,  -- hidden by the admin from lists/pickers
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_supplements_creator (created_by),
  CONSTRAINT fk_supplements_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplement_usage (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id    CHAR(36) NOT NULL,
  supplement_id CHAR(36) NOT NULL,
  use_count     INT NOT NULL DEFAULT 0,
  last_used_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supplement_usage (trainer_id, supplement_id),
  CONSTRAINT fk_supplement_usage_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplement_usage_supplement FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplement_assignments (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id  CHAR(36) NOT NULL,
  athlete_id  CHAR(36) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  status      ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sa_trainer (trainer_id),
  KEY idx_sa_athlete (athlete_id, status),
  CONSTRAINT fk_sa_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_sa_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplement_plan_items (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  assignment_id    CHAR(36) NOT NULL,
  supplement_id    CHAR(36) NOT NULL,
  dose             VARCHAR(100) NOT NULL,     -- متن آزاد، مثل "۵ گرم" یا "۲ کپسول"
  timing           ENUM('before_workout','after_workout','breakfast','lunch','dinner','before_sleep','custom') NOT NULL,
  custom_time      TIME NULL,   -- ساعت یادآوری: اجباری برای custom، اختیاری برای before/after_workout
  note             VARCHAR(255) NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  last_reminded_on DATE NULL,   -- برای این‌که کرون همان روز دوباره یادآوری تکراری نسازد
  KEY idx_spi_assignment (assignment_id, sort_order),
  KEY idx_spi_supplement (supplement_id),
  CONSTRAINT fk_spi_assignment FOREIGN KEY (assignment_id) REFERENCES supplement_assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_spi_supplement FOREIGN KEY (supplement_id) REFERENCES supplements(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- Questionnaire builder: a trainer's own custom form (free text / multiple
-- choice / number questions) sent to athletes, optionally priced through an
-- invoice (item_type 'questionnaire', item_id = questionnaire_responses.id).
-- Unrelated to measurements (the fixed body-assessment table).
-- =========================================================================
CREATE TABLE questionnaires (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  coach_id     CHAR(36) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT NULL,
  price_toman  BIGINT NULL,     -- NULL = رایگان
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  is_public    TINYINT(1) NOT NULL DEFAULT 0,  -- offered to every trainer to copy (owned by an admin)
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_q_coach (coach_id, created_at DESC),
  CONSTRAINT fk_q_coach FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaire_questions (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  questionnaire_id CHAR(36) NOT NULL,
  type             ENUM('text','multiple_choice','number') NOT NULL,
  label            VARCHAR(500) NOT NULL,
  options          JSON NULL,     -- فقط برای multiple_choice: آرایهٔ رشته‌ها
  is_required      TINYINT(1) NOT NULL DEFAULT 1,
  sort_order       INT NOT NULL DEFAULT 0,
  KEY idx_qq_questionnaire (questionnaire_id, sort_order),
  CONSTRAINT fk_qq_questionnaire FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaire_responses (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  questionnaire_id CHAR(36) NOT NULL,
  athlete_id       CHAR(36) NOT NULL,
  status           ENUM('assigned','submitted') NOT NULL DEFAULT 'assigned',
  submitted_at     DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_qr_questionnaire_athlete (questionnaire_id, athlete_id),
  KEY idx_qr_athlete (athlete_id, status),
  CONSTRAINT fk_qr_questionnaire FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
  CONSTRAINT fk_qr_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaire_answers (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  response_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  value       TEXT NULL,   -- متن/عدد به‌صورت رشته، یا برای multiple_choice همان گزینهٔ انتخابی
  UNIQUE KEY uq_qa_response_question (response_id, question_id),
  CONSTRAINT fk_qa_response FOREIGN KEY (response_id) REFERENCES questionnaire_responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_qa_question FOREIGN KEY (question_id) REFERENCES questionnaire_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- sessions (new: replaces Supabase's client-managed JWT with a server-side session)
-- =========================================================================
CREATE TABLE sessions (
  token       CHAR(64)  NOT NULL PRIMARY KEY,   -- random_bytes(32) hex
  user_id     CHAR(36)  NOT NULL,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(45) NULL,
  impersonated_by CHAR(36) NULL,               -- a super admin viewing this user's panel (read_only)
  read_only   TINYINT(1) NOT NULL DEFAULT 0,   -- only GET requests (and logout) are allowed
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_impersonator FOREIGN KEY (impersonated_by) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per user per day they used the panel (Auth::currentUser), for the
-- admin's active-user charts.
CREATE TABLE daily_active (
  day     DATE     NOT NULL,
  user_id CHAR(36) NOT NULL,
  PRIMARY KEY (day, user_id),
  KEY idx_daily_active_user (user_id),
  CONSTRAINT fk_daily_active_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PHP and browser errors, one row per kind of error (ErrorLog).
CREATE TABLE error_logs (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  fingerprint CHAR(40) NOT NULL,
  source      ENUM('server','browser') NOT NULL,
  message     VARCHAR(1000) NOT NULL,
  location    VARCHAR(500) NULL,
  detail      TEXT NULL,
  url         VARCHAR(500) NULL,
  user_id     CHAR(36) NULL,
  user_agent  VARCHAR(255) NULL,
  occurrences INT NOT NULL DEFAULT 1,
  first_seen  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  UNIQUE KEY uq_error_logs_fingerprint (fingerprint),
  KEY idx_error_logs_last_seen (last_seen),
  CONSTRAINT fk_error_logs_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- What an admin deleted, restorable for 30 days (Trash): the rows as JSON.
CREATE TABLE trash (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  kind       VARCHAR(30) NOT NULL,
  label      VARCHAR(255) NOT NULL,
  summary    VARCHAR(500) NULL,
  payload    LONGTEXT NOT NULL,
  deleted_by CHAR(36) NULL,
  deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trash_deleted_at (deleted_at),
  CONSTRAINT fk_trash_deleted_by FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================================
-- Tickets: formal athlete -> trainer requests (separate from `messages`).
-- AUTO_INCREMENT=1000 only makes the first tracking numbers look 4-digit.
-- =========================================================================

CREATE TABLE tickets (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  ticket_number  BIGINT NOT NULL AUTO_INCREMENT,
  trainer_id     CHAR(36) NOT NULL,
  athlete_id     CHAR(36) NOT NULL,
  category       ENUM('plan','nutrition','injury','other') NOT NULL DEFAULT 'other',
  subject        VARCHAR(255) NOT NULL,
  status         ENUM('open','in_progress','closed') NOT NULL DEFAULT 'open',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at      DATETIME NULL,
  UNIQUE KEY uq_tickets_number (ticket_number),
  KEY idx_tickets_trainer (trainer_id, status, updated_at DESC),
  KEY idx_tickets_athlete (athlete_id, status),
  CONSTRAINT fk_tickets_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1000;

CREATE TABLE ticket_messages (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  ticket_id  CHAR(36) NOT NULL,
  sender_id  CHAR(36) NOT NULL,
  body       VARCHAR(2000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tm_ticket (ticket_id, created_at),
  CONSTRAINT fk_tm_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_sender FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- notes: a trainer's private notes, per athlete or general (athlete_id NULL).
-- Never exposed to the athlete. Not the single `note` field on the athlete profile.
-- =========================================================================
CREATE TABLE notes (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id CHAR(36) NOT NULL,
  athlete_id CHAR(36) NULL,   -- NULL = یادداشت کلی مربی، بدون ورزشکار خاص
  content    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notes_trainer (trainer_id, created_at DESC),
  KEY idx_notes_athlete (trainer_id, athlete_id, created_at DESC),
  CONSTRAINT fk_notes_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- trainer_profiles: the trainer's self-written résumé shown to their athletes
-- (one row per trainer). Existing installs: run schema/trainer-profiles-update.sql.
-- =========================================================================

CREATE TABLE trainer_profiles (
  trainer_id     CHAR(36) NOT NULL PRIMARY KEY,
  bio            TEXT NULL,
  achievements   JSON NULL,   -- array of strings, e.g. ["قهرمان کشوری ۱۴۰۱", "مربی تیم ملی"]
  certificates   JSON NULL,   -- array of image URLs (output of UploadController)
  pricing_table  JSON NULL,   -- array of {"title":"...", "price_toman":..., "description":"..."}
  social_links   JSON NULL,   -- {"instagram":"...", "telegram":"...", "website":"..."}
  -- A printed / PDF plan's logo and watermark (trainer-print-branding-update.sql).
  print_logo_url  VARCHAR(1024) NULL,
  print_watermark VARCHAR(80) NULL,
  -- The admin's check of the certificates; 'verified' shows the badge.
  verification_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  verification_note   VARCHAR(500) NULL,
  verification_requested_at DATETIME NULL,
  verified_at    DATETIME NULL,
  verified_by    CHAR(36) NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainer_profiles_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- Coach points: rules the owner edits in phpMyAdmin + a log of awards.
-- =========================================================================
CREATE TABLE point_rules (
  action_type VARCHAR(50) NOT NULL PRIMARY KEY,
  label       VARCHAR(255) NOT NULL,
  points      INT NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT chk_point_rules_points CHECK (points > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO point_rules (action_type, label, points) VALUES
  ('workout_plan_created', 'ساخت برنامهٔ تمرینی', 5),
  ('nutrition_plan_created', 'ساخت برنامهٔ غذایی', 5),
  ('athlete_added', 'افزودن ورزشکار جدید', 10),
  ('ticket_answered', 'پاسخ به تیکت', 3);

CREATE TABLE coach_point_logs (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  coach_id    CHAR(36) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  points      INT NOT NULL,  -- copied from point_rules at award time, not a live reference
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cpl_coach (coach_id, created_at DESC),
  CONSTRAINT fk_cpl_coach FOREIGN KEY (coach_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- assessment_reminders: trainer-set periodic reminder to re-record measurements.
-- =========================================================================
CREATE TABLE assessment_reminders (
  id               CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id       CHAR(36) NOT NULL,
  athlete_id       CHAR(36) NOT NULL,
  interval_weeks   INT NOT NULL DEFAULT 4,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  last_reminded_at DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ar_trainer_athlete (trainer_id, athlete_id),
  CONSTRAINT fk_ar_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_athlete FOREIGN KEY (athlete_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_ar_interval CHECK (interval_weeks > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- app_settings: what the platform admin edits from /admin — one JSON value
-- per settings group. A missing row means that group's defaults (see
-- src/Settings.php), so the table starts empty.
-- =========================================================================
CREATE TABLE app_settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  value       MEDIUMTEXT NOT NULL,
  updated_by  CHAR(36) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- Admin roles, login lockout and two-step admin login (see src/AdminAccess.php,
-- src/Security.php). profiles.admin_role_id is declared with profiles; its
-- foreign key can only be added once admin_roles exists.
-- =========================================================================
CREATE TABLE admin_roles (
  id          CHAR(36) NOT NULL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  permissions TEXT NOT NULL,           -- JSON array of permission keys (src/AdminAccess.php)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE profiles
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

-- =========================================================================
-- discount_codes (phase 6): codes a club enters when paying for a plan
-- =========================================================================
CREATE TABLE discount_codes (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  code          VARCHAR(40) NOT NULL,             -- stored upper-case; matched case-insensitively
  kind          ENUM('percent','amount') NOT NULL,
  value         BIGINT NOT NULL,                  -- 1..100 for percent, toman for amount
  plan_id       CHAR(36) NULL,                    -- NULL = any plan
  max_uses      INT NULL,                         -- NULL = unlimited; pending + approved requests count
  once_per_club TINYINT(1) NOT NULL DEFAULT 0,
  expires_at    DATETIME NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  note          VARCHAR(255) NULL,
  created_by    CHAR(36) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_discount_codes_code (code),
  CONSTRAINT fk_discount_codes_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_discount_codes_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_discount_codes_value CHECK (value > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE payment_requests
  ADD CONSTRAINT fk_payreq_discount FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id) ON DELETE SET NULL;

-- =========================================================================
-- phase 7: broadcasts, support tickets to the platform admin, text pages
-- =========================================================================
CREATE TABLE broadcasts (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NULL,
  link            VARCHAR(500) NULL,
  audience        TEXT NOT NULL,                -- JSON: roles, club_ids, inactive_days
  channels        TEXT NOT NULL,                -- JSON: sms / email = off | opted | all
  status          ENUM('scheduled','sending','sent','cancelled','failed') NOT NULL DEFAULT 'scheduled',
  scheduled_at    DATETIME NULL,                -- NULL = sent right away
  sent_at         DATETIME NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  sms_count       INT NOT NULL DEFAULT 0,
  email_count     INT NOT NULL DEFAULT 0,
  error           VARCHAR(500) NULL,
  created_by      CHAR(36) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_broadcasts_due (status, scheduled_at),
  KEY idx_broadcasts_created (created_at),
  CONSTRAINT fk_broadcasts_creator FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE support_tickets (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  ticket_number BIGINT NOT NULL AUTO_INCREMENT,
  user_id       CHAR(36) NOT NULL,
  category      ENUM('bug','billing','account','suggestion','other') NOT NULL DEFAULT 'other',
  subject       VARCHAR(255) NOT NULL,
  status        ENUM('open','answered','closed') NOT NULL DEFAULT 'open',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at     DATETIME NULL,
  UNIQUE KEY uq_support_tickets_number (ticket_number),
  KEY idx_support_tickets_status (status, updated_at),
  KEY idx_support_tickets_user (user_id, updated_at),
  CONSTRAINT fk_support_tickets_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1000;

CREATE TABLE support_messages (
  id         CHAR(36) NOT NULL PRIMARY KEY,
  seq        BIGINT NOT NULL AUTO_INCREMENT,  -- conversation order (created_at is per second)
  ticket_id  CHAR(36) NOT NULL,
  sender_id  CHAR(36) NULL,
  from_admin TINYINT(1) NOT NULL DEFAULT 0,
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_support_messages_seq (seq),
  KEY idx_support_messages_ticket (ticket_id, seq),
  CONSTRAINT fk_support_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_support_messages_sender FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_pages (
  slug         VARCHAR(60) NOT NULL PRIMARY KEY,
  title        VARCHAR(150) NOT NULL,
  body         MEDIUMTEXT NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  sort_order   INT NOT NULL DEFAULT 0,
  updated_by   CHAR(36) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_site_pages_editor FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO site_pages (slug, title, body, is_published, sort_order) VALUES
  ('terms', 'قوانین و مقررات', '', 0, 1),
  ('privacy', 'حریم خصوصی', '', 0, 2),
  ('faq', 'سؤالات متداول', '', 0, 3),
  ('help', 'راهنما', '', 0, 4);

-- The plans on sale (plan-limits-update.sql adds the same rows to an existing
-- database; club-free-plan-update.sql the free club plan). The free plans
-- are what an account has without paying; their duration is unused.
INSERT INTO trainer_plans (id, name, price_toman, duration_days, max_athletes, is_free, max_custom_exercises, max_templates, history_months, report_level, tier) VALUES
  ('7a000000-0000-4000-8000-000000000001', 'رایگان', 0, 30, 3, 1, 5, 0, 3, 'count', 'free'),
  ('7a000000-0000-4000-8000-000000000002', 'نقره‌ای', 290000, 30, 15, 0, 30, 5, 12, 'basic', 'silver'),
  ('7a000000-0000-4000-8000-000000000003', 'طلایی', 590000, 30, 40, 0, NULL, 20, NULL, 'full', 'gold'),
  ('7a000000-0000-4000-8000-000000000004', 'الماسی', 990000, 30, NULL, 0, NULL, NULL, NULL, 'full_excel', 'diamond');
INSERT INTO plans (id, name, price_toman, duration_days, max_members, max_trainers, tier, is_free) VALUES
  ('7c000000-0000-4000-8000-000000000001', 'رایگان', 0, 30, 20, 1, 'free', 1),
  ('7c000000-0000-4000-8000-000000000002', 'نقره‌ای', 990000, 30, 100, 3, 'silver', 0),
  ('7c000000-0000-4000-8000-000000000003', 'طلایی', 1800000, 30, 300, 8, 'gold', 0),
  ('7c000000-0000-4000-8000-000000000004', 'الماسی', 2900000, 30, NULL, NULL, 'diamond', 0);

-- Access set by hand for one trainer or one club (account-access-update.sql).
CREATE TABLE trainer_access (
  trainer_id CHAR(36) NOT NULL PRIMARY KEY,
  tier       VARCHAR(20) NULL,
  features   TEXT NULL,
  limits     TEXT NULL,
  note       VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trainer_access_trainer FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_trainer_access_admin FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE club_access (
  club_id    CHAR(36) NOT NULL PRIMARY KEY,
  tier       VARCHAR(20) NULL,
  features   TEXT NULL,
  limits     TEXT NULL,
  note       VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_club_access_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  CONSTRAINT fk_club_access_admin FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
