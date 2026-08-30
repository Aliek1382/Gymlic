-- ============================================================================
-- Gymlic — Comments on an assigned plan (trainer <-> athlete back-and-forth)
--
-- One thread per assignment row, e.g. "این حرکت برام سخت بود" from the
-- athlete or a reply from the trainer. workout_assignments and
-- nutrition_assignments are separate tables, so assignment_id can't carry a
-- single FK — a `kind` discriminator picks the right table instead, the
-- same shape notify_plan_assigned() already uses via tg_table_name.
--
-- Unlike notifications, rows here are written directly by the client (this
-- is a user action, not a system event), so RLS carries the full write
-- check; the follow-up notification is still fired by a SECURITY DEFINER
-- trigger so it can't be forged or skipped by the client.
-- ============================================================================

create table plan_comments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('workout', 'nutrition')),
  assignment_id uuid not null,
  author_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index plan_comments_assignment_idx
  on plan_comments (kind, assignment_id, created_at);

alter table plan_comments enable row level security;

-- Is the plan named by (kind, assignment_id) visible to the current user —
-- its trainer, its athlete, or a manager of the club it belongs to? Mirrors
-- the workout_assignments_select / nutrition_assignments_select policies.
create or replace function plan_comment_visible(p_kind text, p_assignment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workout_assignments
    where p_kind = 'workout' and id = p_assignment_id
      and (trainer_id = auth.uid() or athlete_id = auth.uid()
        or (club_id is not null and has_club_role(club_id, array['owner', 'reception']::membership_role[])))
  ) or exists (
    select 1 from nutrition_assignments
    where p_kind = 'nutrition' and id = p_assignment_id
      and (trainer_id = auth.uid() or athlete_id = auth.uid()
        or (club_id is not null and has_club_role(club_id, array['owner', 'reception']::membership_role[])))
  );
$$;

create policy "plan_comments_select" on plan_comments
  for select using (plan_comment_visible(kind, assignment_id));

create policy "plan_comments_insert" on plan_comments
  for insert with check (
    author_id = auth.uid()
    and plan_comment_visible(kind, assignment_id)
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table plan_comments;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- plan_comments: new comment → tell the other side of the conversation
-- (trainer writes → tell the athlete; athlete writes → tell the trainer).
-- ----------------------------------------------------------------------------

create or replace function notify_plan_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainer_id uuid;
  v_athlete_id uuid;
  v_plan_title text;
  v_recipient_id uuid;
  v_link text;
begin
  if new.kind = 'workout' then
    select trainer_id, athlete_id, title into v_trainer_id, v_athlete_id, v_plan_title
    from workout_assignments where id = new.assignment_id;
  else
    select trainer_id, athlete_id, title into v_trainer_id, v_athlete_id, v_plan_title
    from nutrition_assignments where id = new.assignment_id;
  end if;

  if v_athlete_id is null or v_trainer_id is null then
    return new;
  end if;

  if new.author_id = v_athlete_id then
    v_recipient_id := v_trainer_id;
    v_link := case when new.kind = 'workout' then '/workout-programs' else '/nutrition-programs' end;
  else
    v_recipient_id := v_athlete_id;
    v_link := case when new.kind = 'workout' then '/workout' else '/nutrition' end;
  end if;

  if v_recipient_id = new.author_id then
    return new;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    v_recipient_id,
    new.author_id,
    'plan_comment',
    'نظر جدید روی ' || coalesce(v_plan_title, 'برنامه'),
    new.body,
    v_link,
    jsonb_build_object('assignment_id', new.assignment_id, 'kind', new.kind, 'comment_id', new.id)
  );
  return new;
end;
$$;

create trigger plan_comments_notify
  after insert on plan_comments
  for each row execute function notify_plan_comment();
