-- Issue #340: 友達へのエリア紐づけ提案で、相手が未監視のエリアも
-- 提案内容（名前・場所）を見た上で承認・拒否できるようにするため、
-- AREASのSELECT RLSに例外を追加する（2026-10-03開発者確認、docs/schema.md
-- AREASの節参照）。
--
-- 提案者は自分が所有・監視中のエリアしか提案できない（既存ポリシーのまま
-- 変更なし）。このポリシーは、提案を受け取る側（friend_id = auth.uid()）が
-- 未監視のエリアでも、自分宛のpending/approvedなFRIEND_AREA_LINKSが
-- 存在する限りそのエリアを読めるようにするためのもの

create policy "friend area link recipients can read the proposed area"
  on areas for select
  using (
    exists (
      select 1 from friend_area_links
      where friend_area_links.area_id = areas.id
        and friend_area_links.friend_id = auth.uid()
        and friend_area_links.status in ('pending', 'approved')
    )
  );
