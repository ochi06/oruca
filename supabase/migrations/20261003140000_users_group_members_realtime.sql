-- Issue #424: 友達・グループメンバーのプロフィール変更（USERS.name/icon_url、
-- GROUP_MEMBERS.display_name/display_icon_url）が、開いたままのクライアント
-- （友達一覧・グループ詳細）に反映されない問題への対応。
--
-- クライアント側（useNotifyPreferencesStore.ts・useGroupStore.ts・
-- GroupDetailScreen.tsx）でpostgres_changes購読を追加したが、
-- supabase_realtime publicationに対象テーブルが登録されていないと
-- イベント自体が配信されない（Issue #190で発見したuser_areasと同じ罠、
-- 20261001180000_user_areas_realtime.sql参照）。
--
-- 既に手動（Supabase Studio）で登録済みの可能性があるため、二重登録エラーを
-- 避けるためpg_publication_tablesを確認してから追加する
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'users'
  ) then
    alter publication supabase_realtime add table users;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'
  ) then
    alter publication supabase_realtime add table group_members;
  end if;
end $$;
