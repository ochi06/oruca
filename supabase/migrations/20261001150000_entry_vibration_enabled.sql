-- Issue #169: エリア入室通知の振動パターンをオン/オフ設定できるようにする。
--
-- users.entry_vibration_enabled：アカウント全体で1つのグローバル設定
-- （allow_entry_notifications・want_to_meet_notificationと同じ持ち方）。
-- 自分が受信する入室通知（friendships.notify_enabled等で届くと判定された
-- もの）に対して、振動させるかどうかを自分で選べる。デフォルトtrue
-- （オプトアウト方式、既存の各種通知設定フラグと同じ）。
--
-- 既存のRLSポリシー（20260918151313_auth_and_rls.sql「users can manage
-- their own row」）でカバーされるため、ポリシーの追加は不要（自分のusers行は
-- update可）。send-entry-notifications Edge Functionはservice roleで
-- 受信者のこの値を読み取り、Expo Pushメッセージのsound/channelIdを
-- 切り替える。
alter table users
  add column entry_vibration_enabled boolean not null default true;
