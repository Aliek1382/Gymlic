-- ============================================================================
-- Gymlic — Coach <-> athlete inbox
--
-- 0025 gave every assigned plan its own comment thread, reachable only from
-- the plan itself. That leaves the athlete panel without an answer to the
-- simplest question there is: "مربی چی گفت؟" — the messages are scattered
-- across however many plans the trainer has written.
--
-- No new table: a conversation here is derived, not stored. Two people are
-- in one conversation when they share at least one assigned plan, and its
-- messages are every plan_comments row on those plans, merged by time. So
-- an inbox is a grouping of what 0025 already writes, and a reply from the
-- inbox is still an ordinary plan_comments insert (RLS and the
-- notify_plan_comment trigger keep working untouched).
--
-- Unread state comes from the notifications the same trigger already
-- writes: a `plan_comment` row with read_at null, counted per actor. Opening
-- a conversation marks them read through the existing
-- notifications_update_own policy, so the bell and the inbox never disagree.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- One row per person the caller can talk to, newest conversation first.
--
-- SECURITY DEFINER so the aggregate can read plan_comments, notifications
-- and the counterpart's profile in one pass instead of paying the RLS
-- subquery per row; every branch is anchored to auth.uid(), so a caller can
-- only ever see conversations they are themselves a side of.
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
  with plans as (
    -- Templates carry no athlete and drafts were never sent, so neither is
    -- something the two of them can be talking about.
    select id, kind, trainer_id, athlete_id
    from (
      select id, 'workout'::text as kind, trainer_id, athlete_id, status, is_template
        from workout_assignments
      union all
      select id, 'nutrition'::text as kind, trainer_id, athlete_id, status, is_template
        from nutrition_assignments
    ) a
    where not is_template
      and status <> 'draft'
      and athlete_id is not null
      and (trainer_id = auth.uid() or athlete_id = auth.uid())
  ),
  pairs as (
    select
      case when trainer_id = auth.uid() then athlete_id else trainer_id end as counterpart_id,
      case when trainer_id = auth.uid() then 'athlete' else 'trainer' end as counterpart_role,
      id as assignment_id,
      kind
    from plans
  ),
  messages as (
    select p.counterpart_id, c.body, c.author_id, c.created_at
    from pairs p
    join plan_comments c on c.kind = p.kind and c.assignment_id = p.assignment_id
  ),
  conversations as (
    select
      counterpart_id,
      min(counterpart_role) as counterpart_role,
      count(*)::int as plan_count
    from pairs
    group by counterpart_id
  ),
  unread as (
    select actor_id, count(*)::int as unread_count
    from notifications
    where recipient_id = auth.uid()
      and type = 'plan_comment'
      and read_at is null
      and actor_id is not null
    group by actor_id
  ),
  totals as (
    select counterpart_id, count(*)::int as message_count
    from messages
    group by counterpart_id
  )
  select
    c.counterpart_id,
    c.counterpart_role,
    p.first_name,
    p.last_name,
    p.avatar_url,
    c.plan_count,
    coalesce(t.message_count, 0),
    coalesce(u.unread_count, 0),
    last_message.body,
    last_message.author_id,
    last_message.created_at
  from conversations c
  join profiles p on p.id = c.counterpart_id
  left join totals t on t.counterpart_id = c.counterpart_id
  left join unread u on u.actor_id = c.counterpart_id
  left join lateral (
    select m.body, m.author_id, m.created_at
    from messages m
    where m.counterpart_id = c.counterpart_id
    order by m.created_at desc
    limit 1
  ) last_message on true
  order by last_message.created_at desc nulls last, p.first_name nulls last;
$$;

grant execute on function list_message_threads() to authenticated;

-- ----------------------------------------------------------------------------
-- Point the comment notification at the inbox instead of the plan list.
--
-- '/messages?with=<the other side>' opens the conversation the notification
-- came from, which is where a reply is actually written now; the plan itself
-- is one click further in, from the message's own plan chip.
--
-- Also stops notifying about a plan the recipient cannot open. A trainer may
-- comment on their own draft (RLS allows it — it is their row), and 0025
-- then told the athlete about a plan that isn't shown to them anywhere. The
-- inbox leaves those messages out for the same reason, so counting their
-- notifications as unread would leave a badge nothing can clear.
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
  v_status workout_status;
  v_is_template boolean;
  v_recipient_id uuid;
begin
  if new.kind = 'workout' then
    select trainer_id, athlete_id, title, status, is_template
      into v_trainer_id, v_athlete_id, v_plan_title, v_status, v_is_template
    from workout_assignments where id = new.assignment_id;
  else
    select trainer_id, athlete_id, title, status, is_template
      into v_trainer_id, v_athlete_id, v_plan_title, v_status, v_is_template
    from nutrition_assignments where id = new.assignment_id;
  end if;

  if v_athlete_id is null or v_trainer_id is null then
    return new;
  end if;

  if v_is_template or v_status = 'draft' then
    return new;
  end if;

  v_recipient_id := case when new.author_id = v_athlete_id then v_trainer_id else v_athlete_id end;

  if v_recipient_id = new.author_id then
    return new;
  end if;

  insert into notifications (recipient_id, actor_id, type, title, body, link, metadata)
  values (
    v_recipient_id,
    new.author_id,
    'plan_comment',
    'پیام جدید درباره ' || coalesce(v_plan_title, 'برنامه'),
    new.body,
    '/messages?with=' || new.author_id,
    jsonb_build_object('assignment_id', new.assignment_id, 'kind', new.kind, 'comment_id', new.id)
  );
  return new;
end;
$$;

-- Counting a conversation's unread messages filters recipient + type +
-- actor; the 0020 partial index only narrows by recipient, which on a busy
-- account still scans every unread row of every kind.
create index if not exists notifications_unread_plan_comment_idx
  on notifications (recipient_id, actor_id)
  where read_at is null and type = 'plan_comment';
