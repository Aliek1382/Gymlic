-- ============================================================================
-- Gymlic — Notification system
--
-- One generic `notifications` table backs every notification kind (instead
-- of a table per feature), so future features (classes, finance, …) can
-- start writing rows once they exist — just pick a new `type` string, no
-- schema change needed. Every row is written by a SECURITY DEFINER trigger
-- (or, later, an RPC) attached to the event that produced it, never by the
-- client directly, so RLS only has to expose select+update to the recipient.
-- Realtime is enabled on the table so the bell updates without a refresh.
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  type text not null,
  title text not null,
  body text,
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx on notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on notifications (recipient_id) where read_at is null;

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select using (recipient_id = auth.uid());

create policy "notifications_update_own" on notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- No insert/delete policy for authenticated clients on purpose: rows only
-- ever come from the SECURITY DEFINER trigger functions below, which (as
-- the table owner) aren't subject to RLS.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- invitations: accepted → tell whoever created the invite (trainer or club)
-- Covers both acceptance paths in the app (the accept_athlete_invitation RPC
-- and the older client-side acceptInvitation update for trainer/reception
-- invites), since both just flip invitations.status to 'accepted'.
-- ----------------------------------------------------------------------------

create or replace function notify_invitation_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status != 'accepted' or old.status = 'accepted' then
    return new;
  end if;
  if new.created_by = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    new.created_by,
    new.accepted_by,
    'invitation_accepted',
    'دعوت پذیرفته شد',
    case new.invited_role
      when 'athlete' then 'یک ورزشکار جدید دعوت شما را پذیرفت.'
      when 'trainer' then 'یک مربی جدید دعوت شما را پذیرفت.'
      else 'یک عضو جدید دعوت شما را پذیرفت.'
    end,
    case new.invited_role
      when 'athlete' then '/athletes'
      when 'trainer' then '/trainers'
      else '/members'
    end,
    jsonb_build_object('invitation_id', new.id)
  );
  return new;
end;
$$;

create trigger invitations_notify_accepted
  after update of status on invitations
  for each row execute function notify_invitation_accepted();

-- ----------------------------------------------------------------------------
-- workout_assignments / nutrition_assignments: new plan → tell the athlete
-- ----------------------------------------------------------------------------

create or replace function notify_plan_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when tg_table_name = 'workout_assignments' then 'workout' else 'nutrition' end;
begin
  if new.athlete_id is null then
    return new;
  end if;
  if new.athlete_id = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    new.athlete_id,
    new.trainer_id,
    v_kind || '_assigned',
    case when v_kind = 'workout' then 'برنامه تمرینی جدید' else 'برنامه غذایی جدید' end,
    new.title,
    case when v_kind = 'workout' then '/workout' else '/nutrition' end,
    jsonb_build_object('assignment_id', new.id)
  );
  return new;
end;
$$;

create trigger workout_assignments_notify_assigned
  after insert on workout_assignments
  for each row execute function notify_plan_assigned();

create trigger nutrition_assignments_notify_assigned
  after insert on nutrition_assignments
  for each row execute function notify_plan_assigned();

-- ----------------------------------------------------------------------------
-- workout_assignments / nutrition_assignments: completed → tell the trainer
-- ----------------------------------------------------------------------------

create or replace function notify_plan_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when tg_table_name = 'workout_assignments' then 'workout' else 'nutrition' end;
begin
  if new.status != 'completed' or old.status = 'completed' then
    return new;
  end if;
  if new.trainer_id = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    new.trainer_id,
    new.athlete_id,
    v_kind || '_completed',
    case when v_kind = 'workout' then 'برنامه تمرینی تکمیل شد' else 'برنامه غذایی تکمیل شد' end,
    new.title,
    case when v_kind = 'workout' then '/workout-programs' else '/nutrition-programs' end,
    jsonb_build_object('assignment_id', new.id)
  );
  return new;
end;
$$;

create trigger workout_assignments_notify_completed
  after update of status on workout_assignments
  for each row execute function notify_plan_completed();

create trigger nutrition_assignments_notify_completed
  after update of status on nutrition_assignments
  for each row execute function notify_plan_completed();

-- ----------------------------------------------------------------------------
-- measurements: new entry → tell the other party (athlete logs it → tell
-- their trainer(s); trainer logs it → tell the athlete)
-- ----------------------------------------------------------------------------

create or replace function notify_measurement_recorded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainer record;
begin
  if new.recorded_by is null then
    return new;
  end if;

  if new.recorded_by = new.athlete_id then
    for v_trainer in
      select trainer_id from trainer_athletes
      where athlete_id = new.athlete_id and status = 'active'
    loop
      insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
      values (
        v_trainer.trainer_id,
        new.athlete_id,
        'measurement_recorded',
        'اندازه‌گیری جدید',
        'ورزشکار یک اندازه‌گیری بدنی جدید ثبت کرد.',
        '/progress',
        jsonb_build_object('athlete_id', new.athlete_id, 'measurement_id', new.id)
      );
    end loop;
  else
    insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
    values (
      new.athlete_id,
      new.recorded_by,
      'measurement_recorded',
      'اندازه‌گیری جدید',
      'مربی شما یک اندازه‌گیری بدنی جدید برایتان ثبت کرد.',
      '/progress',
      jsonb_build_object('measurement_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger measurements_notify_recorded
  after insert on measurements
  for each row execute function notify_measurement_recorded();

-- ----------------------------------------------------------------------------
-- memberships: new athlete joins a club → tell the club owner
-- ----------------------------------------------------------------------------

create or replace function notify_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  if new.role != 'athlete' or new.status != 'active' or new.club_id is null then
    return new;
  end if;

  select owner_id into v_owner_id from clubs where id = new.club_id;
  if v_owner_id is null or v_owner_id = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    return new;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    v_owner_id,
    new.user_id,
    'member_joined',
    'عضو جدید',
    'یک عضو جدید به باشگاه شما پیوست.',
    '/members',
    jsonb_build_object('member_id', new.user_id)
  );
  return new;
end;
$$;

create trigger memberships_notify_member_joined
  after insert on memberships
  for each row execute function notify_member_joined();
