-- ============================================================================
-- Gymlic — Let a trainer remove an athlete (or cancel a pending invite)
-- ============================================================================

-- trainer_athletes had no delete policy at all — a trainer could never
-- unlink an athlete from their roster.
create policy "trainer_athletes_delete_trainer" on trainer_athletes
  for delete using (trainer_id = auth.uid());
