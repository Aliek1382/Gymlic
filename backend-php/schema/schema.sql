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
  is_platform_admin  TINYINT(1) NOT NULL DEFAULT 0,
  is_suspended       TINYINT(1) NOT NULL DEFAULT 0,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_profiles_phone (phone),
  UNIQUE KEY uq_profiles_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- clubs
-- =========================================================================
CREATE TABLE clubs (
  id              CHAR(36) NOT NULL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  logo_url        VARCHAR(1024) NULL,
  owner_id        CHAR(36) NOT NULL,
  status          ENUM('active','suspended','pending') NOT NULL DEFAULT 'pending',
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
  plan_tier  ENUM('elite','basic','daily') NOT NULL DEFAULT 'basic',
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
  plan_tier    ENUM('elite','basic','daily') NULL,
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
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
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
  plan_name  VARCHAR(255) NOT NULL,
  status     ENUM('active','expiring','expired') NOT NULL DEFAULT 'active',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_subscriptions_club (club_id),
  CONSTRAINT fk_subscriptions_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- payment_requests
-- =========================================================================
CREATE TABLE payment_requests (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  club_id        CHAR(36) NOT NULL,
  plan_id        CHAR(36) NOT NULL,
  submitted_by   CHAR(36) NOT NULL,
  amount_toman   BIGINT NOT NULL,
  reference_note TEXT NULL,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note     TEXT NULL,
  reviewed_by    CHAR(36) NULL,
  reviewed_at    DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payreq_club (club_id, created_at DESC),
  KEY idx_payreq_status (status),
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
  muscle_group  VARCHAR(100) NOT NULL,
  created_by    CHAR(36) NULL,
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

CREATE TABLE workout_plan_exercises (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  day_id         CHAR(36) NOT NULL,
  exercise_id    CHAR(36) NOT NULL,
  sets           INT NULL,
  reps           VARCHAR(50) NULL,
  weight_kg      DECIMAL(6,2) NULL,
  rest_seconds   INT NULL,
  note           VARCHAR(500) NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_wpe_day (day_id, sort_order),
  KEY idx_wpe_exercise (exercise_id),
  CONSTRAINT fk_wpe_day FOREIGN KEY (day_id) REFERENCES workout_plan_days(id) ON DELETE CASCADE,
  CONSTRAINT fk_wpe_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id)
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
  created_by    CHAR(36) NULL,
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
-- messages
-- =========================================================================
CREATE TABLE messages (
  id            CHAR(36) NOT NULL PRIMARY KEY,
  sender_id     CHAR(36) NOT NULL,
  recipient_id  CHAR(36) NOT NULL,
  body          VARCHAR(1000) NOT NULL,
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

-- =========================================================================
-- trainer_payments
-- =========================================================================
CREATE TABLE trainer_payments (
  id           CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id   CHAR(36) NOT NULL,
  athlete_id   CHAR(36) NULL,
  amount_toman BIGINT NOT NULL,
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
-- nutrition_assignments.id or session_packages.id), so it carries no FK.
-- =========================================================================
CREATE TABLE invoices (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  trainer_id     CHAR(36) NOT NULL,
  athlete_id     CHAR(36) NOT NULL,
  item_type      ENUM('workout_plan','nutrition_plan','session_package') NOT NULL,
  item_id        CHAR(36) NOT NULL,   -- workout_assignments.id, nutrition_assignments.id or
                                      -- session_packages.id (polymorphic, so no real FK)
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
-- sessions (new: replaces Supabase's client-managed JWT with a server-side session)
-- =========================================================================
CREATE TABLE sessions (
  token       CHAR(64)  NOT NULL PRIMARY KEY,   -- random_bytes(32) hex
  user_id     CHAR(36)  NOT NULL,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
