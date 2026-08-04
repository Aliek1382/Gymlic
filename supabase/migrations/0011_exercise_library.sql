-- ============================================================================
-- Gymlic — Exercise Library
--
-- A shared bank of exercises a trainer can pick from when building a
-- workout plan. Rows with created_by = null are Gymlic's built-in presets
-- (visible to every trainer); rows with created_by set are a trainer's own
-- custom exercises, visible only to them.
-- ============================================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  created_by uuid references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index exercises_created_by_idx on exercises (created_by);

alter table exercises enable row level security;

create policy "exercises_select" on exercises
  for select using (created_by is null or created_by = auth.uid());

create policy "exercises_insert_own" on exercises
  for insert with check (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Preset exercises (created_by = null), grouped by muscle group
-- ----------------------------------------------------------------------------

insert into exercises (name, muscle_group) values
  ('پرس سینه هالتر', 'سینه'),
  ('پرس سینه دمبل', 'سینه'),
  ('پرس بالا سینه', 'سینه'),
  ('شنا سوئدی', 'سینه'),
  ('قفسه سینه با دمبل', 'سینه'),
  ('کراس اُور', 'سینه'),
  ('بارفیکس', 'پشت'),
  ('زیر بغل سیم‌کش', 'پشت'),
  ('پارویی هالتر', 'پشت'),
  ('پارویی دمبل تک‌خم', 'پشت'),
  ('ددلیفت', 'پشت'),
  ('لت پول‌داون', 'پشت'),
  ('اسکات', 'پا'),
  ('پرس پا', 'پا'),
  ('لانگز', 'پا'),
  ('جلو پا با دستگاه', 'پا'),
  ('پشت پا با دستگاه', 'پا'),
  ('ددلیفت رومانیایی', 'پا'),
  ('پرس سرشانه هالتر', 'شانه'),
  ('پرس سرشانه دمبل', 'شانه'),
  ('نشر جانب', 'شانه'),
  ('نشر خم', 'شانه'),
  ('فیس پول', 'شانه'),
  ('جلو بازو هالتر', 'جلو بازو'),
  ('جلو بازو دمبل', 'جلو بازو'),
  ('جلو بازو چکشی', 'جلو بازو'),
  ('پشت بازو سیم‌کش', 'پشت بازو'),
  ('پشت بازو هالتر خوابیده', 'پشت بازو'),
  ('دیپ', 'پشت بازو'),
  ('کرانچ', 'شکم'),
  ('پلانک', 'شکم'),
  ('بالا آوردن پا آویزان', 'شکم'),
  ('دویدن', 'کاردیو'),
  ('طناب زدن', 'کاردیو'),
  ('دوچرخه ثابت', 'کاردیو');
