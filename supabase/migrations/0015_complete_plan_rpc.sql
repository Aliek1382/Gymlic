-- ============================================================================
-- Gymlic — Mark a workout/nutrition plan as completed
--
-- Both the trainer and the athlete should be able to mark an active plan as
-- done (the Reports feature counts completed plans per athlete). The base
-- write policies on workout_assignments/nutrition_assignments only let the
-- trainer update rows, so a security-definer RPC is used instead of opening
-- up a broader UPDATE policy to the athlete — it only ever flips
-- active -> completed on a row the caller is a party to.
-- ============================================================================

create or replace function complete_workout_assignment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update workout_assignments
  set status = 'completed'
  where id = p_id
    and status = 'active'
    and (trainer_id = auth.uid() or athlete_id = auth.uid());

  if not found then
    raise exception 'برنامه یافت نشد یا اجازه تغییر آن را ندارید.';
  end if;
end;
$$;

create or replace function complete_nutrition_assignment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update nutrition_assignments
  set status = 'completed'
  where id = p_id
    and status = 'active'
    and (trainer_id = auth.uid() or athlete_id = auth.uid());

  if not found then
    raise exception 'برنامه یافت نشد یا اجازه تغییر آن را ندارید.';
  end if;
end;
$$;

grant execute on function complete_workout_assignment(uuid) to authenticated;
grant execute on function complete_nutrition_assignment(uuid) to authenticated;
