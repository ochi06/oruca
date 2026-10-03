-- Issue #367（US-011方針転換、2026-10-03 developer確認済み・docs/schema.md反映済み）：
-- 滞在予定をエリアごとの個別入力（area_schedules/area_schedule_overrides）から、
-- ユーザー1人につき1つの自由記述欄（users.schedule_note）に統合する。
-- 当日限定の上書き予定という概念も廃止し、新設するひとことメッセージ
-- （users.status_message）にその役割を統合する。
-- 公開範囲は両カラムとも、usersの行全体に適用される既存RLS
-- （"friends can read each other's profile"、friendships.status = 'active'）に
-- そのまま乗る。エリア紐づけ（friend_area_links）の条件は無し

alter table users add column schedule_note text;
alter table users add column status_message text;

drop table area_schedule_overrides;
drop table area_schedules;
