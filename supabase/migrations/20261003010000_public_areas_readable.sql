-- Issue #333: 公開エリア検索（AreaRegistrationScreenの検索UI、docs/schema.md
-- AREASの節参照）をSupabase実データに接続するために必要なRLSポリシー。
--
-- 現状areasには「所有者」「監視中（USER_AREAS）」「自分宛のpending/approved
-- なFRIEND_AREA_LINKSがある」の3ポリシーしか無く、is_public=trueであっても
-- 他ユーザーからは検索・閲覧できない。GROUPS.is_public向けの
-- "public groups are readable by anyone"（20260930170000_groups_and_rls.sql、
-- 後にGROUPS.is_public自体はIssue #202で廃止）と同じ考え方で、
-- AREAS.is_public向けに追加する

create policy "public areas are readable by anyone"
  on areas for select
  using (is_public = true);
