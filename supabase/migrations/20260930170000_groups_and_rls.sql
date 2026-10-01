-- Issue #144: GROUPS/GROUP_MEMBERSのバックエンド接続。
-- docs/schema.mdにテーブル定義はあったが、実際のmigrationにはまだ
-- create tableされていなかったため、このmigrationで新規作成する
-- （既存テーブルは変更しない方針。docs/schema.md「設計上の重要な原則」4.参照）。

create table groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  invite_code text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  invited_by uuid references users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table groups enable row level security;
alter table group_members enable row level security;

-- GROUPS: ownerは自分のグループを読み書きできる。加えて、is_public=trueの行と
-- approvedなメンバーである行は検索・閲覧用に読める（Issue #119）
create policy "owners can manage their own groups"
  on groups for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "public groups are readable by anyone"
  on groups for select
  using (is_public = true);

create policy "approved members can read their groups"
  on groups for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
        and group_members.status = 'approved'
    )
  );

-- GROUP_MEMBERS: 自分の行／同じgroupのowner／同じgroupのapprovedメンバーが読める
create policy "group_members readable by self, owner, or approved members"
  on group_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from groups
      where groups.id = group_members.group_id
        and groups.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from group_members gm2
      where gm2.group_id = group_members.group_id
        and gm2.user_id = auth.uid()
        and gm2.status = 'approved'
    )
  );

-- INSERT: 自分の行を申請(status='pending', invited_byなし)として作る、
-- またはowner/既存承認済みメンバーがinvited_by付きで招待する
create policy "users can request to join or be invited by owner/members"
  on group_members for insert
  with check (
    (user_id = auth.uid() and status = 'pending' and invited_by is null)
    or (
      invited_by = auth.uid()
      and (
        exists (
          select 1 from groups
          where groups.id = group_members.group_id
            and groups.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from group_members gm2
          where gm2.group_id = group_members.group_id
            and gm2.user_id = auth.uid()
            and gm2.status = 'approved'
        )
      )
    )
  );

-- UPDATE: owner（pending→approved/rejectedの更新）、または招待された本人が
-- 自分への招待(invited_by is not null)をpendingの間に承諾/辞退する場合
create policy "owners can update group_members status"
  on group_members for update
  using (
    exists (
      select 1 from groups
      where groups.id = group_members.group_id
        and groups.owner_user_id = auth.uid()
    )
    or (
      user_id = auth.uid()
      and invited_by is not null
      and status = 'pending'
    )
  )
  with check (
    exists (
      select 1 from groups
      where groups.id = group_members.group_id
        and groups.owner_user_id = auth.uid()
    )
    or (
      user_id = auth.uid()
      and invited_by is not null
    )
  );

-- DELETE: 自分の行（退会／招待の辞退）、またはowner（メンバー除名）
create policy "self or owner can delete a group_members row"
  on group_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from groups
      where groups.id = group_members.group_id
        and groups.owner_user_id = auth.uid()
    )
  );
