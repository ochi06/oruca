-- Issue #131: プッシュ通知の実配信基盤。
-- Expo Push Serviceの宛先となるExpoPushToken（"ExponentPushToken[...]"形式の文字列）を
-- 端末ごとに1件保存する。複数端末対応・トークン失効時の扱いは将来課題とし、
-- 現状は「最後にログインした端末のトークンで上書きする」という単純な設計にする。
-- 既存のRLSポリシー（20260918151313_auth_and_rls.sql）でこの列もカバーされるため、
-- ポリシーの追加は不要（自分の行はupdate可）。
-- 送信側（Edge Function）はservice roleでRLSをバイパスして読み取る想定。
alter table users
  add column push_token text;
