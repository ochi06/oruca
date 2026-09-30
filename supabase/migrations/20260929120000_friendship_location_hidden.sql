-- Issue #121: 友達ブロック（一方向、位置情報の非表示）。
-- 自分の行でlocation_hidden=trueにすると、相手（friend_id）は自分の
-- presence_logsを閲覧できなくなる。他の受信側設定列（muted等）と違い、
-- 「情報を隠す側」が自分の行に設定する点に注意。友達関係自体（status）は
-- 変更しない。
--
-- クライアント側フィルタに依存せず、presence_logsのSELECTポリシー自体に
-- ブロック確認を組み込んでDBレベルで強制する（2026-09-29、開発者確認済み）。
-- 既存の「presence in monitored areas is readable」ポリシー
-- （20260918151313_auth_and_rls.sql）を置き換える。
alter table friendships
  add column location_hidden boolean not null default false;

drop policy "presence in monitored areas is readable" on presence_logs;

create policy "presence in monitored areas is readable"
  on presence_logs for select
  using (
    exists (
      select 1 from user_areas
      where user_areas.area_id = presence_logs.area_id and user_areas.user_id = auth.uid()
    )
    and not exists (
      select 1 from friendships
      where friendships.user_id = presence_logs.user_id
        and friendships.friend_id = auth.uid()
        and friendships.location_hidden = true
    )
  );
