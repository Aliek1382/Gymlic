-- ============================================================================
-- Gymlic — Body-measurement progress charts
--
-- Adds waist/chest circumference alongside the existing height/weight/body
-- fat columns (BMI is derived at read time from weight + latest known
-- height, not stored). Both the trainer and the athlete can log a
-- measurement, but only the person who recorded a given entry can edit it —
-- the previous insert policy didn't pin recorded_by to the actual caller,
-- and there was no update policy at all (so nobody could edit anything).
-- ============================================================================

alter table measurements add column if not exists waist_cm numeric(5, 1);
alter table measurements add column if not exists chest_cm numeric(5, 1);

drop policy if exists "measurements_write" on measurements;

create policy "measurements_insert" on measurements
  for insert with check (
    recorded_by = auth.uid()
    and (athlete_id = auth.uid() or is_trainer_of(athlete_id))
  );

create policy "measurements_update_own" on measurements
  for update using (recorded_by = auth.uid())
  with check (recorded_by = auth.uid());
