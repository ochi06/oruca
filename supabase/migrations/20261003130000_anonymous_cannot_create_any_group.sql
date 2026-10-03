-- Issue #405: developer方針変更（2026-10-03）。
--
-- Issue #151時点（20261001170000_anonymous_open_group_join.sql）では
-- 「オープングループ主催者自身が匿名で始めるケースは妨げない」想定で、
-- type='open'のグループ作成のみ匿名アカウントに許可していた。
-- この想定を変更し、匿名アカウントはtype問わずグループの新規作成を
-- 一切不可にする（オープングループへの参加は引き続き許可・変更なし）。
--
-- 既存のRESTRICTIVEポリシー「anonymous users cannot create closed groups」を
-- 置き換える形で、type='open'の例外を無くした新ポリシーに差し替える
drop policy "anonymous users cannot create closed groups" on groups;

create policy "anonymous users cannot create groups"
  on groups as restrictive
  for insert
  with check ((auth.jwt() ->> 'is_anonymous')::boolean is not true);
