-- ============================================================================
-- Gymlic — Private trainer notes on an athlete
--
-- A trainer-only note about one of their athletes ("زانوش مشکل داره", "هفته
-- پیش سفر بود") — visible only to the trainer who wrote it, not the athlete
-- or anyone else. trainer_athletes already has exactly one row per
-- (trainer, athlete) pair, so the note lives there rather than in a new
-- table.
-- ============================================================================

alter table trainer_athletes add column if not exists note text;

-- No update policy existed on this table before (rows were only ever
-- inserted/deleted). A trainer may now update their own relationship row —
-- in practice only the note, since the app never writes anything else here.
create policy "trainer_athletes_update_trainer" on trainer_athletes
  for update using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
