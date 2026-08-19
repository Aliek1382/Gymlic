-- ============================================================================
-- Gymlic — Per-day workout completion log
--
-- complete_workout_assignment (0015) flips a plan to 'completed' for good,
-- which suits a one-off program but not a weekly one: ticking each day as a
-- permanent flag would leave every day ticked forever after week one. So a
-- dated row is logged per session instead — the tick clears on its own when
-- the week rolls over, and the athlete keeps a training history for free.
--
-- Days have no table of their own: a plan is a single free-text description
-- and a "day" is one of its "شنبه — پا:" headings, recovered at read time by
-- parsePlanDescription. day_key therefore stores that heading text. Renaming
-- a heading orphans the rows logged under the old one, which is acceptable —
-- they stay as an accurate record of what was done on those dates, and the
-- renamed day simply starts a fresh series.
-- ============================================================================

create table workout_day_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references workout_assignments (id) on delete cascade,
  athlete_id uuid not null references profiles (id) on delete cascade,
  -- The plan section heading this log belongs to, e.g. "شنبه — پا".
  day_key text not null,
  -- Sent by the client as its *local* date: current_date here is UTC, which
  -- would file a late-evening session in Tehran under the previous day.
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  -- Makes ticking idempotent — the same day can't be logged twice on one date.
  unique (assignment_id, day_key, completed_on)
);

create index workout_day_logs_athlete_idx
  on workout_day_logs (athlete_id, completed_on);

alter table workout_day_logs enable row level security;

-- Unlike the plan-level RPC, no security-definer function is needed here:
-- the athlete owns their own log rows, so plain insert/delete policies cover
-- ticking and unticking. The insert check also confirms the assignment is
-- actually theirs, so a log can't be filed against someone else's plan.
create policy "workout_day_logs_select" on workout_day_logs
  for select using (athlete_id = auth.uid() or is_trainer_of(athlete_id));

create policy "workout_day_logs_insert_own" on workout_day_logs
  for insert with check (
    athlete_id = auth.uid()
    and exists (
      select 1
      from workout_assignments
      where workout_assignments.id = assignment_id
        and workout_assignments.athlete_id = auth.uid()
    )
  );

create policy "workout_day_logs_delete_own" on workout_day_logs
  for delete using (athlete_id = auth.uid());
