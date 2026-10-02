-- Issue #198: グループのオーナー譲渡（transferOwnership）が常にRLS違反で
-- 失敗する不具合を修正する。
--
-- 原因：既存の"owners can manage their own groups"（FOR ALL）の
-- WITH CHECKは owner_user_id = auth.uid() を要求する。これはUPDATEでは
-- 更新後の行に対して評価されるため、owner_user_idを譲渡先に変更した瞬間
-- 「更新後の行のowner_user_id(=譲渡先) = auth.uid()(=譲渡元)」が必ず偽になり、
-- オーナー譲渡という操作自体がこのポリシー設計では原理的に不可能だった
-- （開発者承認済み、2026-10-02）。
--
-- 対応方針の検討：UPDATE用のWITH CHECKを緩和する案（USING側で旧
-- owner_user_id=auth.uid()を判定し、WITH CHECKをtrueにする）をローカル
-- Supabaseで実機検証したが、SELECT用ポリシー（"owners can select their
-- own groups" 等、owner_user_id=auth.uidを条件にするもの）が同じテーブルに
-- 存在すると、UPDATE後の新しい行がそのSELECTポリシーの条件も満たす必要が
-- あるらしく（PostgreSQLのRLS実装の詳細、ドキュメント上の記述からは
-- 必ずしも自明ではない挙動）、WITH CHECKをtrueにしても新owner_user_idが
-- 元のauth.uid()と一致しない以上やはり失敗することを確認した
-- （using(true) with check(true)の完全無条件ポリシー単体でも、SELECT
-- ポリシーが別途存在するだけで同じエラーが再現する）。
--
-- そのため、#177のis_group_owner等と同じSECURITY DEFINER関数経由の方式
-- （選択肢2）を採用する。groupsテーブルのRLSポリシー自体は変更しない。

create or replace function transfer_group_ownership(p_group_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from groups where id = p_group_id and owner_user_id = auth.uid()
  ) then
    raise exception 'forbidden: not the current owner of this group';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = p_new_owner_id and status = 'approved'
  ) then
    raise exception 'new owner must be an approved member of this group';
  end if;

  update groups set owner_user_id = p_new_owner_id where id = p_group_id;
end;
$$;
