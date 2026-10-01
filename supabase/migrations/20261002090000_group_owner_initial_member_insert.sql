-- Issue #197: グループ作成直後、作成者(owner)自身を status='approved' な
-- 初期メンバーとしてgroup_membersにINSERTする処理（lib/groups.tsのcreateGroup()）が、
-- RLSのINSERT用WITH CHECKのどの分岐にも該当せず常に拒否されていた
-- （クローズグループは必ず失敗、オープングループはis_open_group()条件に
-- たまたま一致して通っていただけ）。
--
-- 「グループのowner本人が、自分自身の承認済み初期行を作る」ケースを
-- type（open/closed）によらず許可する分岐を追加する（開発者承認済み、2026-10-02）。
-- 既存の3分岐はそのまま維持し、追加のみ行う。
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
      user_id = auth.uid()
      and status = 'approved'
      and invited_by is null
      and is_group_owner(group_members.group_id, auth.uid())
    )
    or (
      invited_by = auth.uid()
      and (
        is_group_owner(group_members.group_id, auth.uid())
        or is_approved_group_member(group_members.group_id, auth.uid())
      )
    )
  );
