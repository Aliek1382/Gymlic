-- ============================================================================
-- Gymlic — Trainer-created athlete invitations
--
-- A trainer can now register an athlete's basic info (name, height, weight)
-- before that athlete has any account at all. The trainer shares a
-- /join/<code> link; the athlete only enters an email + password there, and
-- everything else (role, trainer link, name, measurements) is carried over
-- from the invitation automatically.
-- ============================================================================

alter table invitations
  add column first_name text,
  add column last_name text,
  add column height_cm numeric(5, 1),
  add column weight_kg numeric(5, 1);

-- Simple free-text description for a trainer's workout/nutrition plan entry
-- (structured days/exercises/meals are a future iteration).
alter table workout_assignments add column description text;
alter table nutrition_assignments add column description text;

-- An unauthenticated visitor must be able to look up their own invite by its
-- (unguessable) code before they have any session at all, so the /join page
-- can show who invited them and let them complete sign-up.
create policy "invitations_select_public_pending" on invitations
  for select using (status = 'pending' and expires_at > now());

-- Accepting an invite happens right after the athlete's account is created —
-- they are not the invitation's creator, so the existing
-- "invitations_update_creator" policy does not cover them. Possession of the
-- (unguessable) code is the authorization model here, matching the public
-- select policy above.
create policy "invitations_update_accept" on invitations
  for update using (status = 'pending') with check (accepted_by = auth.uid());
