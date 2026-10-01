-- Issue #177: groups/group_membersのRLSが相互にEXISTSで参照し合っていたため
-- （groupsの"approved members can read their groups"がgroup_membersを参照、
-- group_membersの各ポリシーがgroupsを参照）、PostgreSQLがRLS評価中に循環を
-- 検出し"infinite recursion detected in policy"でグループ取得自体が失敗していた。
--
-- security definer関数（RLSをバイパスして実行される）経由にすることで、
-- 評価の連鎖をそこで止め、循環を断ち切る（redeem_friend_otp・
-- find_open_group_by_invite_codeと同じ考え方）。

create or replace function is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from groups
    where groups.id = p_group_id and groups.owner_user_id = p_user_id
  );
$$;

create or replace function is_approved_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_members.group_id = p_group_id
      and group_members.user_id = p_user_id
      and group_members.status = 'approved'
  );
$$;

create or replace function is_open_group(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from groups
    where groups.id = p_group_id and groups.type = 'open'
  );
$$;

-- GROUPS: group_membersへの直接EXISTSをis_approved_group_member()に置き換える
drop policy "approved members can read their groups" on groups;

create policy "approved members can read their groups"
  on groups for select
  using (is_approved_group_member(groups.id, auth.uid()));

-- GROUP_MEMBERS: groupsへの直接EXISTS（owner判定・open判定）を
-- is_group_owner()/is_open_group()に置き換える
drop policy "group_members readable by self, owner, or approved members" on group_members;

create policy "group_members readable by self, owner, or approved members"
  on group_members for select
  using (
    user_id = auth.uid()
    or is_group_owner(group_members.group_id, auth.uid())
    or is_approved_group_member(group_members.group_id, auth.uid())
  );

drop policy "users can request to join or be invited by owner/members" on group_members;

create policy "users can request to join or be invited by owner/members"
  on group_members for insert
  with check (
    (user_id = auth.uid() and status = 'pending' and invited_by is null)
    or (
      user_id = auth.uid()
      and status = 'approved'
      and invited_by is null
      and is_open_group(group_members.group_id)
    )
    or (
      invited_by = auth.uid()
      and (
        is_group_owner(group_members.group_id, auth.uid())
        or is_approved_group_member(group_members.group_id, auth.uid())
      )
    )
  );

drop policy "owners can update group_members status" on group_members;

create policy "owners can update group_members status"
  on group_members for update
  using (
    is_group_owner(group_members.group_id, auth.uid())
    or (
      user_id = auth.uid()
      and invited_by is not null
      and status = 'pending'
    )
  )
  with check (
    is_group_owner(group_members.group_id, auth.uid())
    or (
      user_id = auth.uid()
      and invited_by is not null
    )
  );

drop policy "self or owner can delete a group_members row" on group_members;

create policy "self or owner can delete a group_members row"
  on group_members for delete
  using (
    user_id = auth.uid()
    or is_group_owner(group_members.group_id, auth.uid())
  );
