-- ============================================================================
-- Gymlic — Trainer earnings ledger
--
-- Until now every amount in the schema was club-level: revenue_entries is a
-- club's recognized income, and payment_requests/plans is a club paying the
-- platform for its own subscription. Neither carries a trainer_id, so a
-- trainer working on athlete fees had no way to see what they actually earn.
--
-- trainer_payments is that missing ledger: one row per fee a trainer
-- received from one of their athletes. There is no payment gateway, so the
-- trainer records each payment themselves — exactly like a club owner
-- records revenue_entries — and the rows stay private to them.
-- ============================================================================

create table trainer_payments (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles (id) on delete cascade,
  -- Nullable with `on delete set null` on purpose: an athlete deleting
  -- their account must not silently erase money the trainer already
  -- earned. The insert policy below still demands a real, active athlete,
  -- so null only ever appears after the fact.
  athlete_id uuid references profiles (id) on delete set null,
  amount_toman bigint not null check (amount_toman > 0),
  -- The date the money changed hands — what the monthly buckets group by,
  -- mirroring revenue_entries.occurred_at.
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trainer_payments_trainer_idx on trainer_payments (trainer_id, paid_at desc);
create index trainer_payments_athlete_idx on trainer_payments (athlete_id);

create trigger trainer_payments_set_updated_at
  before update on trainer_payments
  for each row execute function set_updated_at();

alter table trainer_payments enable row level security;

-- Earnings are private to the trainer who recorded them — not visible to
-- the club they work at, to other trainers, or to the athlete who paid.
create policy "trainer_payments_select_own" on trainer_payments
  for select using (trainer_id = auth.uid());

-- Pin trainer_id to the caller and require the athlete to actually be one
-- of theirs, so a payment can neither be filed under another trainer's name
-- nor against someone they don't train. is_trainer_of() returns false for a
-- null athlete_id, which also blocks inserting an unattributed row.
create policy "trainer_payments_insert_own" on trainer_payments
  for insert with check (trainer_id = auth.uid() and is_trainer_of(athlete_id));

-- Editing and deleting key on trainer_id alone: a trainer must still be
-- able to correct or remove an old entry after that athlete has left them,
-- at which point is_trainer_of() no longer holds.
create policy "trainer_payments_update_own" on trainer_payments
  for update using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

create policy "trainer_payments_delete_own" on trainer_payments
  for delete using (trainer_id = auth.uid());
