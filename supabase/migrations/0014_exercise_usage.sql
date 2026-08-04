-- ============================================================================
-- Gymlic — Exercise Library: per-trainer usage tracking
--
-- Powers the "most used first" ordering in the exercise picker used inside
-- the workout plan builder. One row per (trainer, exercise); incremented
-- every time that trainer inserts the exercise into a plan.
-- ============================================================================

create table exercise_usage (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles (id) on delete cascade,
  exercise_id uuid not null references exercises (id) on delete cascade,
  use_count integer not null default 0,
  last_used_at timestamptz not null default now(),
  unique (trainer_id, exercise_id)
);

create index exercise_usage_trainer_idx on exercise_usage (trainer_id);

alter table exercise_usage enable row level security;

create policy "exercise_usage_select_own" on exercise_usage
  for select using (trainer_id = auth.uid());

create policy "exercise_usage_insert_own" on exercise_usage
  for insert with check (trainer_id = auth.uid());

create policy "exercise_usage_update_own" on exercise_usage
  for update using (trainer_id = auth.uid());
