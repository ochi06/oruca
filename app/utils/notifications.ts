import { Friendship } from '../mocks/presence';

// 友達の入室を、自分から通知してよいか判定する（US-007）。
//
// 現時点ではnotify_enabledのみを見るが、将来的にはUS-008のmuted（受信側の
// ミュート）・US-016の共在時のみ通知・US-017の優先通知などの条件が
// 積み重なる「通知優先順位の条件分岐ロジック」の起点となる関数
// （docs/ai-collaboration-plan.md「US-007, 008：通知許可・ミュート・ブロック」参照）。
//
// 通知を送るかどうかは送信側（自分）の意思だけで完結させる方針
// （受信側の調整はUS-008のミュート機能に任せる。docs/oruca_PRD.md「US-007」参照）
export function shouldSendEntryNotification(friendship: Friendship): boolean {
  return friendship.notify_enabled;
}
