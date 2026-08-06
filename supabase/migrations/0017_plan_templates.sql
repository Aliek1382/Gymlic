-- ============================================================================
-- Gymlic — Reusable plan templates
--
-- Lets a trainer save a workout/nutrition plan as a reusable template
-- (no athlete/invitation attached) and start a new plan from one later.
-- Templates reuse the existing assignment tables instead of a separate
-- schema — same shape, just athlete_id/invitation_id left null and
-- is_template flagged, so they share the same query/RLS patterns already
-- in place. Applying a template is copy-on-use at the application layer
-- (the client pre-fills the form from the template row and a normal save
-- inserts a fresh, independent assignment) — editing a template later
-- never changes plans already sent out.
-- ============================================================================

alter table workout_assignments add column if not exists is_template boolean not null default false;
alter table nutrition_assignments add column if not exists is_template boolean not null default false;

alter table workout_assignments drop constraint if exists workout_assignments_target_chk;
alter table workout_assignments
  add constraint workout_assignments_target_chk
  check (is_template or athlete_id is not null or invitation_id is not null);

alter table nutrition_assignments drop constraint if exists nutrition_assignments_target_chk;
alter table nutrition_assignments
  add constraint nutrition_assignments_target_chk
  check (is_template or athlete_id is not null or invitation_id is not null);

create index if not exists workout_assignments_template_idx on workout_assignments (trainer_id) where is_template;
create index if not exists nutrition_assignments_template_idx on nutrition_assignments (trainer_id) where is_template;
