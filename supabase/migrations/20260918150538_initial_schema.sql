-- docs/schema.md の正式スキーマに対応する初期マイグレーション。
-- 認証方式（OTP/Supabase Auth連携）は未確定のため、usersテーブルは
-- auth.usersへのFKを持たない独立テーブルとして作成する（後日決定次第、
-- 別マイグレーションで紐付ける）。
-- RLSは全テーブルで有効化するが、ポリシーは未追加（fail-closedの状態で
-- 開始し、認証方式が決まってから各テーブルにポリシーを追加する）。

create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m integer not null check (radius_m >= 10 and radius_m <= 200),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, area_id)
);

create table friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  friend_id uuid not null references users(id) on delete cascade,
  notify_enabled boolean not null default true,
  muted boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id != friend_id)
);

create table friend_area_links (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references users(id) on delete cascade,
  friend_id uuid not null references users(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (initiator_id != friend_id)
);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table presence_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  area_id uuid not null references areas(id) on delete cascade,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  lat double precision,
  lng double precision
);

alter table users enable row level security;
alter table areas enable row level security;
alter table user_areas enable row level security;
alter table friendships enable row level security;
alter table friend_area_links enable row level security;
alter table otp_codes enable row level security;
alter table presence_logs enable row level security;
