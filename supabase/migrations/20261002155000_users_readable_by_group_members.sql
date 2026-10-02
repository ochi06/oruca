-- Issue #214: グループメンバー一覧で、友達関係にないメンバーの名前が常に
-- 「不明なユーザー」になる不具合の根本対応（開発者承認済み、2026-10-02）。
--
-- docs/schema.mdのGROUP_MEMBERSの項に元々「グループ内での名前公開は
-- status = 'approved'であることのみを条件とする」という設計意図が書かれて
-- いたが、public.usersのRLSには「自分の行」「承認済みFRIEND_AREA_LINKSが
-- ある相手の行」の2条件しか無く、「同じグループのapprovedメンバー同士」
-- という条件が未実装だった。
--
-- group_members自体のRLS（is_group_owner/is_approved_group_member、
-- 20261001160000_group_rls_recursion_fix.sql）はusersテーブルを参照しない
-- ため、このポリシーが新たにgroup_membersを参照しても循環は発生しない。
create policy "users can read fellow approved group members' profile"
  on users for select
  using (
    exists (
      select 1
      from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid()
        and gm1.status = 'approved'
        and gm2.user_id = users.id
        and gm2.status = 'approved'
    )
  );
