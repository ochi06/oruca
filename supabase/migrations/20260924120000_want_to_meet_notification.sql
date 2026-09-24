-- US-017: 会いたい人の入室通知（Issue #15）。
--
-- friendships.want_to_meet：受信側設定（mutedと同じ所有モデル）。ONの間、
-- notify_only_when_copresent（US-016）の制限を上書きし、共在していなくても
-- その友達の入室通知を受け取る。
-- users.allow_entry_notifications：アカウント全体で1つのグローバル許可。
-- 「自分の入室を、自分をwant_to_meetで登録している相手に通知してよいか」。
-- 既存の友達ごとのnotify_enabled（US-007/016）とは別物で、通常の入室通知
-- には影響しない。デフォルトtrue（オプトアウト方式、notify_enabledと同じ）。
--
-- 既存のRLSポリシー（20260918151313_auth_and_rls.sql）でどちらの列もカバー
-- されるため、ポリシーの追加は不要（自分のusers行・friendships行はupdate可）。
-- 優先度の分岐（muted最優先→want_to_meetが共在制限を上書き）はアプリ側
-- （utils/notifications.ts の shouldSendWantToMeetNotification）で行う。
alter table friendships
  add column want_to_meet boolean not null default false;

alter table users
  add column allow_entry_notifications boolean not null default true;
