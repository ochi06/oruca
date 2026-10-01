-- Issue #151: オープングループへの参加のみ、メール登録なし
-- （supabase.auth.signInAnonymously()）で可能にする。
--
-- 注意：ここで使う(auth.jwt() ->> 'is_anonymous')::booleanは、Supabase Auth
-- 標準の「匿名ログインで作られたセッションか」を表すJWTクレームであり、
-- USERS.is_anonymous（US-013、一時的に在席を非公開にするアカウント設定、
-- docs/schema.md参照）とは全く別物。名前が似ているだけなので混同しないこと。
--
-- 匿名アカウントはオープングループの範囲に限定し、クローズな機能
-- （friendships作成、closedグループの作成・参加）からは締め出す
-- （2026-10-01開発者確認、Issue #151本文）。
-- RESTRICTIVEポリシーとして追加する：既存のPERMISSIVEなINSERT許可条件
-- （「users can manage their own friendships」等）はそのまま変更せず、
-- 匿名アカウントの場合にAND条件で追加拒否する形にする
-- （PostgreSQLのRLSはPERMISSIVE同士はOR、RESTRICTIVEはANDで合成される）。

-- FRIENDSHIPS：匿名アカウントはfriendshipsを作成できない
create policy "anonymous users cannot create friendships"
  on friendships as restrictive
  for insert
  with check ((auth.jwt() ->> 'is_anonymous')::boolean is not true);

-- GROUPS：匿名アカウントはtype='closed'のグループを作成できない
-- （type='open'の作成は許可。オープングループ主催者自身が匿名で始めるケースは
-- 妨げない）
create policy "anonymous users cannot create closed groups"
  on groups as restrictive
  for insert
  with check (
    type = 'open'
    or (auth.jwt() ->> 'is_anonymous')::boolean is not true
  );

-- GROUP_MEMBERS：匿名アカウントは対象グループがtype='open'の場合のみ参加できる
-- （is_open_group()はIssue #177で追加済みのsecurity definer関数を再利用し、
-- RLS循環参照を避ける）
create policy "anonymous users cannot join closed groups"
  on group_members as restrictive
  for insert
  with check (
    is_open_group(group_members.group_id)
    or (auth.jwt() ->> 'is_anonymous')::boolean is not true
  );
