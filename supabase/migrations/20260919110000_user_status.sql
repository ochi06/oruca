-- US-014: ステータス表示機能（Issue #10）。
-- 「作業中」「合流したい」等、自分の状況を示すための列をUSERSに追加する。
-- 既存のRLSポリシー（20260918151313_auth_and_rls.sql）でこの列も
-- カバーされるため、ポリシーの追加は不要：
--   - 自分の行はupdate可（"users can manage their own row"）
--   - 承認済みの友達はselect可（"users can read approved friends' profile"）
-- ＝名前・アイコンと同じ可視性ルールがそのままステータスにも適用される
alter table users
  add column status text check (status in ('working', 'want_to_join', 'away', 'focus'));
