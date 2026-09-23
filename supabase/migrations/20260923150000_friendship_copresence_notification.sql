-- US-016: 共在時のみの入室通知（Issue #14）。
-- mutedと同じ所有モデル（受信側が自分の行に設定する値）。既存のRLSポリシー
-- （20260918151313_auth_and_rls.sql "users can manage their own friendships"）
-- でこの列もカバーされるため、ポリシーの追加は不要。
-- 「ONの間、自分が入室先エリアに在席している時だけ通知する」という条件分岐は
-- アプリ側（utils/notifications.ts の shouldSendEntryNotification）で行う。
-- 実際の通知イベントの記録・既読管理は別Issueで検討する。
alter table friendships
  add column notify_only_when_copresent boolean not null default false;
