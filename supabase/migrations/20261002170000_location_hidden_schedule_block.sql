-- Issue #271 (US-008 ブロック機能化): location_hiddenの適用範囲を
-- area_schedules / area_schedule_overrides（滞在予定）にも拡張する。
-- 列名・テーブル構造は変更せず、既存のpresence_logs向けブロック確認
-- （20260929120000_friendship_location_hidden.sql）と同じパターンを
-- area_schedules/area_schedule_overridesのSELECTポリシーに追加するのみ
-- （2026-10-02、開発者確認済み・docs/schema.md「FRIENDSHIPS」節参照）。
--
-- グループ内在席表示（所属グループ内での在席表示）は、GroupDetailScreenが
-- presence_logsを直接クエリするため、presence_logs側のブロック確認で
-- 既にDBレベルで適用済み（追加の変更は不要）。
drop policy "approved friends can read area_schedules" on area_schedules;

create policy "approved friends can read area_schedules"
  on area_schedules for select
  using (
    exists (
      select 1 from friend_area_links
      where friend_area_links.status = 'approved'
        and friend_area_links.area_id = area_schedules.area_id
        and (
          (friend_area_links.initiator_id = auth.uid() and friend_area_links.friend_id = area_schedules.user_id)
          or (friend_area_links.friend_id = auth.uid() and friend_area_links.initiator_id = area_schedules.user_id)
        )
    )
    and not exists (
      select 1 from friendships
      where friendships.user_id = area_schedules.user_id
        and friendships.friend_id = auth.uid()
        and friendships.location_hidden = true
    )
  );

drop policy "approved friends can read area_schedule_overrides" on area_schedule_overrides;

create policy "approved friends can read area_schedule_overrides"
  on area_schedule_overrides for select
  using (
    exists (
      select 1 from friend_area_links
      where friend_area_links.status = 'approved'
        and friend_area_links.area_id = area_schedule_overrides.area_id
        and (
          (friend_area_links.initiator_id = auth.uid() and friend_area_links.friend_id = area_schedule_overrides.user_id)
          or (friend_area_links.friend_id = auth.uid() and friend_area_links.initiator_id = area_schedule_overrides.user_id)
        )
    )
    and not exists (
      select 1 from friendships
      where friendships.user_id = area_schedule_overrides.user_id
        and friendships.friend_id = auth.uid()
        and friendships.location_hidden = true
    )
  );
