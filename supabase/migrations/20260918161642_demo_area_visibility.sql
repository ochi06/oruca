-- DEMO SHORTCUT (ADR-0008): 本来はFRIEND_AREA_LINKS承認が必要。
-- デモのため、同じエリア（USER_AREAS）に参加している相手のusers行
-- （name/icon_url）を読めるようにする。デモ終了後に削除する想定。
create policy "demo: same-area users are readable"
  on users for select
  using (
    exists (
      select 1
      from user_areas mine
      join user_areas theirs on theirs.area_id = mine.area_id
      where mine.user_id = auth.uid()
        and theirs.user_id = users.id
    )
  );
