-- US-013: 一時的な匿名モード（Issue #13）。
-- アカウント全体で1つのON/OFF（エリア単位ではない）。既存のRLSポリシー
-- （20260918151313_auth_and_rls.sql）でこの列もカバーされるため、
-- ポリシーの追加は不要（自分の行はupdate可、承認済みの友達はselect可）。
-- 「ONの間、承認済みの友達にも名前・在席を見せない」という可視性の分岐は
-- アプリ側（store/usePresenceStore.ts の resolveDisplayName/buildInitialState）
-- で行う。
alter table users
  add column is_anonymous boolean not null default false;
