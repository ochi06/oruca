-- Issue #79: ADR-0008で追加したデモ限定の緩和を元に戻す。
-- デモが終了したため、同じエリアに参加しているだけでusers行を読めるように
-- していたポリシーを削除し、本来の設計（docs/schema.md「設計上の重要な原則」：
-- 名前表示は必ずFRIEND_AREA_LINKS.status = 'approved'をチェックしてから）に戻す
-- （docs/decisions/0008-demo-area-visibility-shortcut.md参照）。
drop policy "demo: same-area users are readable" on users;
