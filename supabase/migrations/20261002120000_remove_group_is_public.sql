-- Issue #202: 公開グループ検索機能（GROUPS.is_public、Issue #119）を廃止する。
-- open/closedのグループ種別（Issue #148）が整理された結果、
-- 「グループを検索して参加申請し、管理者の承認を待つ」という経路は
-- 現在の設計と矛盾するため（closedは元々関わりのある人同士が対象で
-- 見知らぬ相手の検索参加に馴染まず、openは招待コードさえあれば承認不要・
-- 即参加できることが前提のため）。グループへの参加はclosed＝招待のみ、
-- open＝招待コード/QRのみの2通りに統一する。
--
-- AREAS.is_public（Issue #65、公開エリア検索）は別物のため対象外。

drop policy "public groups are readable by anyone" on groups;

alter table groups drop column is_public;
