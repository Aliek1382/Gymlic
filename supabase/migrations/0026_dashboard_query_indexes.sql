-- The dashboard loads several counts/aggregates per page view that all
-- filter memberships by (club_id, role, status), and workout/nutrition
-- assignments by (trainer_id, is_template, status) — the single-column
-- indexes from earlier migrations only get Postgres to the right club or
-- trainer, then scan every row to apply the rest. These composite indexes
-- cover the actual filter combinations the app runs.

create index if not exists memberships_club_role_status_idx
  on memberships (club_id, role, status, joined_at);

create index if not exists workout_assignments_trainer_status_idx
  on workout_assignments (trainer_id, is_template, status, assigned_at);

create index if not exists nutrition_assignments_trainer_status_idx
  on nutrition_assignments (trainer_id, is_template, status, assigned_at);
