# ADR-0008: デモ限定の近道 — 同エリア参加者は自動的に見える

## 決定事項

- **デモ用の一時的な近道として**、同じエリアに参加している（`USER_AREAS`に
  行がある）ユーザーは、`FRIEND_AREA_LINKS`が承認済みかどうかに関わらず、
  互いに名前・アイコン付きで見える状態にする
- 対象は`docs/oruca_PRD.md`・`docs/schema.md`の本来の設計（`docs/schema.md`
  「設計上の重要な原則」2.：名前表示には`FRIEND_AREA_LINKS.status='approved'`
  が必須）から**意図的に外れる**。デモが終わったら本来の設計に戻す

## 理由

- 今夜のデモでは、実ユーザー同士が友達追加（US-005のOTP）を全員完了させる
  時間が無い。同じエリアに参加しただけで在席状況が見えるようにした方が、
  デモの見栄えとして分かりやすい

## 本来の設計に戻す際の対応

- Issue #58・#59の実装で、この近道を使った箇所には
  `// DEMO SHORTCUT (ADR-0008): 本来はFRIEND_AREA_LINKS承認が必要`
  のようなコメントを付け、後から検索して戻せるようにする
- デモ終了後、この近道を無効化し、本来の`resolveDisplayName`ロジック
  （承認済みのみ表示）に一本化する

## 対応済み（2026-09-19、Issue #79）

デモ終了に伴い、上記の近道を元に戻した。
- `supabase/migrations/20260919100000_revert_demo_area_visibility.sql`で
  `"demo: same-area users are readable"`ポリシーを削除
- `app/store/usePresenceStore.ts`の`areaParticipantUserIds`引数・関連ロジックを削除し、
  `resolveDisplayName`（`FRIEND_AREA_LINKS.status='approved'`必須）のみに一本化
