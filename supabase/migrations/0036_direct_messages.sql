-- ============================================================================
-- Gymlic — messages: a conversation that doesn't need a plan
--
-- 0035 built the inbox out of plan_comments, which ties every message to an
-- assigned plan. That leaves the one person most likely to have a question
-- unable to ask it: an athlete who has just joined and hasn't been given a
-- plan yet. It also means the very first thing a trainer might want to send
-- ("خوش اومدی، این هفته بیا باشگاه تا اندازه‌هات رو بگیرم") has nowhere to go.
--
-- So the message becomes the thing that is stored, and the plan becomes an
-- optional detail on it:
--
--   plan_kind/plan_id set  → written about that plan; shown in the plan's own
--                            thread and in the inbox, exactly as before.
--   plan_kind/plan_id null → an ordinary direct message.
--
-- plan_comments is retired rather than kept in parallel: its rows are copied
-- across (ids and timestamps preserved) and its write path is removed, so
-- there is one table to read and one place a message can be. The table
-- itself is left in place, readable, as the archive of what was migrated.
--
-- Unread state moves onto the row (messages.read_at) instead of being
-- inferred from the notification a trigger happened to write — the inbox can
-- now count what is actually unread rather than what was announced.
-- ============================================================================

create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 1000),
  -- The plan this message is about, when it is about one. Both columns move
  -- together: a kind without an id (or the reverse) would be a thread nobody
  -- can find.
  plan_kind text check (plan_kind in ('workout', 'nutrition')),
  plan_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_not_self check (sender_id <> recipient_id),
  constraint messages_plan_ref check ((plan_kind is null) = (plan_id is null))
);

-- One index per direction: a conversation is read as "everything between
-- these two", which is two half-scans, one per column order.
create index messages_sent_idx on messages (sender_id, recipient_id, created_at);
create index messages_received_idx on messages (recipient_id, sender_id, created_at);

create index messages_unread_idx on messages (recipient_id, sender_id)
  where read_at is null;

create index messages_plan_idx on messages (plan_kind, plan_id, created_at)
  where plan_id is not null;

-- ----------------------------------------------------------------------------
-- Who may message whom
--
-- The trainer/athlete relationship itself, which exists from the moment an
-- invitation is accepted — that is the whole point of this migration. A
-- shared plan counts too, so the pairs 0035 already treated as conversations
-- keep working even where trainer_athletes has no row for them (a club
-- invited the athlete directly, or an older account predates that link).
-- ----------------------------------------------------------------------------

create or replace function can_message(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select p_other is not null
    and auth.uid() is not null
    and p_other <> auth.uid()
    and (
      exists (
        select 1 from trainer_athletes
        where status = 'active'
          and ((trainer_id = auth.uid() and athlete_id = p_other)
            or (trainer_id = p_other and athlete_id = auth.uid()))
      )
      or exists (
        select 1 from workout_assignments
        where not is_template and status <> 'draft'
          and ((trainer_id = auth.uid() and athlete_id = p_other)
            or (trainer_id = p_other and athlete_id = auth.uid()))
      )
      or exists (
        select 1 from nutrition_assignments
        where not is_template and status <> 'draft'
          and ((trainer_id = auth.uid() and athlete_id = p_other)
            or (trainer_id = p_other and athlete_id = auth.uid()))
      )
    );
$$;

grant execute on function can_message(uuid) to authenticated;

-- A plan may only be attached to a message between that plan's own trainer
-- and athlete — otherwise a message could claim to be about a plan its
-- recipient has nothing to do with, and would surface in that plan's thread.
create or replace function plan_belongs_to_pair(p_kind text, p_plan_id uuid, p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workout_assignments
    where p_kind = 'workout' and id = p_plan_id
      and not is_template and status <> 'draft'
      and ((trainer_id = auth.uid() and athlete_id = p_other)
        or (trainer_id = p_other and athlete_id = auth.uid()))
  ) or exists (
    select 1 from nutrition_assignments
    where p_kind = 'nutrition' and id = p_plan_id
      and not is_template and status <> 'draft'
      and ((trainer_id = auth.uid() and athlete_id = p_other)
        or (trainer_id = p_other and athlete_id = auth.uid()))
  );
$$;

-- What was written on a club's plan stays visible to that club, the way
-- plan_comment_visible had it in 0025. A message with no plan on it is not a
-- note on the club's paperwork — it is private to the two people in it.
create or replace function plan_message_visible_to_club(p_kind text, p_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workout_assignments
    where p_kind = 'workout' and id = p_plan_id and club_id is not null
      and has_club_role(club_id, array['owner', 'reception']::membership_role[])
  ) or exists (
    select 1 from nutrition_assignments
    where p_kind = 'nutrition' and id = p_plan_id and club_id is not null
      and has_club_role(club_id, array['owner', 'reception']::membership_role[])
  );
$$;

alter table messages enable row level security;

create policy "messages_select" on messages
  for select using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or (plan_id is not null and plan_message_visible_to_club(plan_kind, plan_id))
  );

create policy "messages_insert" on messages
  for insert with check (
    sender_id = auth.uid()
    and can_message(recipient_id)
    and (plan_id is null or plan_belongs_to_pair(plan_kind, plan_id, recipient_id))
  );

-- The recipient marks their own copy read; nothing else about a sent message
-- may change, which the trigger below enforces column by column (RLS can
-- gate the row, not the column).
create policy "messages_update_read" on messages
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create or replace function messages_freeze_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or new.body is distinct from old.body
    or new.plan_kind is distinct from old.plan_kind
    or new.plan_id is distinct from old.plan_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'تنها وضعیت خوانده‌شدن پیام قابل تغییر است.';
  end if;
  return new;
end;
$$;

create trigger messages_freeze_content_check
  before update on messages
  for each row execute function messages_freeze_content();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Carry the existing threads over
--
-- Runs before the notification trigger below exists, so copying history
-- doesn't re-announce years-old comments to everyone. Ids and timestamps are
-- preserved, so a notification that already points at a comment id still
-- points at the same message. Read state is taken from the notification that
-- comment produced — it is the only record of whether the recipient saw it.
--
-- Comments on a draft or template plan are left behind. RLS let a trainer
-- write those on their own unfinished plan and the athlete was never shown
-- them; turning them into messages now would deliver a trainer's private
-- working notes to the athlete years late. They stay in the archive.
-- ----------------------------------------------------------------------------

insert into messages (id, sender_id, recipient_id, body, plan_kind, plan_id, read_at, created_at)
select
  c.id,
  c.author_id,
  case when c.author_id = a.athlete_id then a.trainer_id else a.athlete_id end,
  -- 0025 capped a comment at 500 characters, half of what a message allows.
  left(c.body, 1000),
  c.kind,
  c.assignment_id,
  n.read_at,
  c.created_at
from plan_comments c
join (
  select id, trainer_id, athlete_id, 'workout' as kind from workout_assignments
  where not is_template and status <> 'draft'
  union all
  select id, trainer_id, athlete_id, 'nutrition' as kind from nutrition_assignments
  where not is_template and status <> 'draft'
) a on a.id = c.assignment_id and a.kind = c.kind
left join lateral (
  select read_at from notifications
  where type = 'plan_comment' and metadata ->> 'comment_id' = c.id::text
  limit 1
) n on true
where a.athlete_id is not null
  and a.trainer_id is not null
  and case when c.author_id = a.athlete_id then a.trainer_id else a.athlete_id end <> c.author_id
on conflict (id) do nothing;

-- plan_comments no longer takes writes: the insert policy is gone and so is
-- its notification trigger. Existing rows stay readable as the archive of
-- what the copy above moved.
drop trigger if exists plan_comments_notify on plan_comments;
drop policy if exists "plan_comments_insert" on plan_comments;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_comments'
  ) then
    alter publication supabase_realtime drop table plan_comments;
  end if;
end $$;

comment on table plan_comments is
  'Superseded by messages (0036). Read-only archive: rows were copied into messages with their ids and timestamps intact.';

-- ----------------------------------------------------------------------------
-- messages: new message → tell the recipient
-- ----------------------------------------------------------------------------

create or replace function notify_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_title text;
begin
  if new.plan_id is not null then
    if new.plan_kind = 'workout' then
      select title into v_plan_title from workout_assignments where id = new.plan_id;
    else
      select title into v_plan_title from nutrition_assignments where id = new.plan_id;
    end if;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    new.recipient_id,
    new.sender_id,
    'message',
    case
      when v_plan_title is not null then 'پیام جدید درباره ' || v_plan_title
      else 'پیام جدید'
    end,
    new.body,
    '/messages?with=' || new.sender_id,
    jsonb_build_object('message_id', new.id, 'plan_id', new.plan_id, 'plan_kind', new.plan_kind)
  );
  return new;
end;
$$;

create trigger messages_notify
  after insert on messages
  for each row execute function notify_message();

-- ----------------------------------------------------------------------------
-- The inbox, now listing people rather than only conversations
--
-- Everyone the caller may message appears, including someone they have never
-- exchanged a word with — that row is exactly how a first message gets sent.
-- Anyone they have messaged appears too, even if the link since lapsed
-- (a trainer removed the athlete), so history never silently disappears.
-- ----------------------------------------------------------------------------

create or replace function list_message_threads()
returns table (
  counterpart_id uuid,
  counterpart_role text,
  first_name text,
  last_name text,
  avatar_url text,
  plan_count integer,
  message_count integer,
  unread_count integer,
  last_message_body text,
  last_message_author_id uuid,
  last_message_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with shared_plans as (
    select id, trainer_id, athlete_id
    from (
      select id, trainer_id, athlete_id, status, is_template from workout_assignments
      union all
      select id, trainer_id, athlete_id, status, is_template from nutrition_assignments
    ) a
    where not is_template
      and status <> 'draft'
      and athlete_id is not null
      and (trainer_id = auth.uid() or athlete_id = auth.uid())
  ),
  links as (
    select trainer_id, athlete_id
    from trainer_athletes
    where status = 'active' and (trainer_id = auth.uid() or athlete_id = auth.uid())
    union
    select trainer_id, athlete_id from shared_plans
  ),
  conversation as (
    select
      case when sender_id = auth.uid() then recipient_id else sender_id end as counterpart_id,
      sender_id,
      body,
      created_at,
      read_at,
      recipient_id
    from messages
    where sender_id = auth.uid() or recipient_id = auth.uid()
  ),
  counterparts as (
    select case when trainer_id = auth.uid() then athlete_id else trainer_id end as counterpart_id
    from links
    union
    select counterpart_id from conversation
  ),
  plan_totals as (
    select
      case when trainer_id = auth.uid() then athlete_id else trainer_id end as counterpart_id,
      count(*)::int as plan_count
    from shared_plans
    group by 1
  ),
  message_totals as (
    select
      counterpart_id,
      count(*)::int as message_count,
      count(*) filter (
        where recipient_id = auth.uid() and read_at is null
      )::int as unread_count
    from conversation
    group by counterpart_id
  )
  select
    c.counterpart_id,
    -- The two roles that have an inbox only ever talk to each other, so the
    -- viewer's own role names the other side without a per-row lookup.
    case
      when (select account_type from profiles where id = auth.uid()) = 'trainer'
      then 'athlete' else 'trainer'
    end,
    p.first_name,
    p.last_name,
    p.avatar_url,
    coalesce(pt.plan_count, 0),
    coalesce(mt.message_count, 0),
    coalesce(mt.unread_count, 0),
    last_message.body,
    last_message.sender_id,
    last_message.created_at
  from counterparts c
  join profiles p on p.id = c.counterpart_id
  left join plan_totals pt on pt.counterpart_id = c.counterpart_id
  left join message_totals mt on mt.counterpart_id = c.counterpart_id
  left join lateral (
    select m.body, m.sender_id, m.created_at
    from conversation m
    where m.counterpart_id = c.counterpart_id
    order by m.created_at desc
    limit 1
  ) last_message on true
  order by last_message.created_at desc nulls last, p.first_name nulls last;
$$;

grant execute on function list_message_threads() to authenticated;
