-- Issue #270: 入室通知ロジックの統合。
-- 「自分も同じエリアに在席中なら通知」を個別トグルではなく常時適用の
-- ルールに統合したため、notify_only_when_copresent列（US-016、Issue #14）
-- を廃止する（docs/schema.md「FRIENDSHIPS」2026-10-02更新箇所参照）。
-- want_to_meetは独立した別ルールとして残る
alter table friendships
  drop column notify_only_when_copresent;
