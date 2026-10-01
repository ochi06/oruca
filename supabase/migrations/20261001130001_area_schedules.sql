-- Issue #159 (US-011): AREA_SCHEDULES / AREA_SCHEDULE_OVERRIDESの
-- CREATE TABLE・RLS追加（docs/schema.md「設計上の重要な原則」2. および
-- 「AREA_SCHEDULES」「AREA_SCHEDULE_OVERRIDES」節に記載・確定済みの方針に
-- 沿う。時刻・曜日は構造化せずnoteに自由記述、という設計も既存docs通り）
create table area_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, area_id)
);

create table area_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, area_id, date)
);

alter table area_schedules enable row level security;
alter table area_schedule_overrides enable row level security;

-- 本人は自分の行をすべて操作できる。他ユーザーの行は、対象エリアで
-- FRIEND_AREA_LINKS.status = 'approved'の関係がある場合のみSELECT可
-- （usersテーブルの「users can read approved friends' profile」と同じ形）
create policy "users can manage their own area_schedules"
  on area_schedules for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "approved friends can read area_schedules"
  on area_schedules for select
  using (
    exists (
      select 1 from friend_area_links
      where friend_area_links.status = 'approved'
        and friend_area_links.area_id = area_schedules.area_id
        and (
          (friend_area_links.initiator_id = auth.uid() and friend_area_links.friend_id = area_schedules.user_id)
          or (friend_area_links.friend_id = auth.uid() and friend_area_links.initiator_id = area_schedules.user_id)
        )
    )
  );

create policy "users can manage their own area_schedule_overrides"
  on area_schedule_overrides for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "approved friends can read area_schedule_overrides"
  on area_schedule_overrides for select
  using (
    exists (
      select 1 from friend_area_links
      where friend_area_links.status = 'approved'
        and friend_area_links.area_id = area_schedule_overrides.area_id
        and (
          (friend_area_links.initiator_id = auth.uid() and friend_area_links.friend_id = area_schedule_overrides.user_id)
          or (friend_area_links.friend_id = auth.uid() and friend_area_links.initiator_id = area_schedule_overrides.user_id)
        )
    )
  );
