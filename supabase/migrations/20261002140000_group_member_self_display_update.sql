-- Issue #199: group_membersの表示名/アイコン上書き（Issue #150）が、
-- オーナー以外の自分の行に対して常にサイレント失敗していた不具合を修正する。
--
-- 原因：旧ポリシー「owners can update group_members status」のUSING句は、
-- 本人による自分の行の更新を「invited_by is not null and status = 'pending'」
-- （＝招待されて未承諾の一時的な状態）の時だけ許していた。オープングループへの
-- QR自己参加（invited_by=null）・招待承諾後（status='approved'）のいずれも
-- この条件を満たさず、display_name/display_icon_urlの更新ができなかった。
--
-- 対応：RLS自体は「本人は自分の行なら（状態によらず）UPDATE可能」まで広げ、
-- 実際にどの列を変更してよいかはBEFORE UPDATEトリガーで列単位に制御する
-- （PostgreSQLのRLSはrow単位の可否のみでcolumn単位の制御ができないため、
-- 標準的なパターンとしてトリガーを使う。is_group_owner等の既存security
-- definer関数と同じ考え方）。
--
-- 許可する内容：
-- - owner：従来通りすべての列を変更可能
-- - 本人（owner以外）：
--   - display_name/display_icon_urlの変更は自由に許可（Issue #150本来の目的）
--   - group_id/user_id/invited_byの変更は常に禁止
--   - statusの変更は「招待承諾（pending→approved、invited_by not null時）」
--     の1パターンのみ許可（Issue #117の既存フローを維持）。それ以外の
--     status変更（例：自分でrejectedにする等）は禁止

drop policy "owners can update group_members status" on group_members;

create policy "owners can update group_members status"
  on group_members for update
  using (
    is_group_owner(group_id, auth.uid())
    or user_id = auth.uid()
  )
  with check (
    is_group_owner(group_id, auth.uid())
    or user_id = auth.uid()
  );

create or replace function protect_group_members_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_group_owner(old.group_id, auth.uid()) then
    return new;
  end if;

  if old.user_id = auth.uid() and new.user_id = auth.uid() then
    if new.group_id is distinct from old.group_id
      or new.user_id is distinct from old.user_id
      or new.invited_by is distinct from old.invited_by
    then
      raise exception 'group_members: group_id/user_id/invited_by cannot be changed by the member themselves';
    end if;

    if new.status is distinct from old.status
      and not (old.status = 'pending' and new.status = 'approved' and old.invited_by is not null)
    then
      raise exception 'group_members: invalid status transition for self-update';
    end if;

    return new;
  end if;

  raise exception 'group_members: not authorized to update this row';
end;
$$;

create trigger group_members_protect_self_update
  before update on group_members
  for each row
  execute function protect_group_members_self_update();
