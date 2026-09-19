import { Friendship } from '../mocks/presence';

// 友達の入室を通知してよいか判定する（US-007・US-008）。
//
// notify_enabled（送信側：自分がこの相手に通知を送るか）と
// muted（受信側：自分がこの相手からの通知をミュートしているか）を組み合わせる。
// docs/oruca_PRD.md「通知：送信許可とミュート（US-007, US-008）」に明記されている
// 「通知をオフにする設定は常に最優先される」というルールに従い、mutedが
// trueならnotify_enabledの値に関わらず通知しない（mutedが優先）。
// 将来的にはUS-016の共在時のみ通知・US-017の優先通知などの条件も
// 積み重なる「通知優先順位の条件分岐ロジック」の起点となる関数
// （docs/ai-collaboration-plan.md「US-007, 008：通知許可・ミュート・ブロック」参照）。
//
// 注意：notify_enabledとmutedは、どちらも「friendshipの行の持ち主が
// friend_idに対して設定した値」という同じ形の行から読む前提。実際の通知
// 送信を実装する際は、送信者（入室した本人）の行のnotify_enabledと、
// 受信者（通知を受け取る側）の行のmutedは別々の行になる点に注意する
// （呼び出し側で正しい行を組み合わせて渡すこと）
export function shouldSendEntryNotification(friendship: Friendship): boolean {
  return friendship.notify_enabled && !friendship.muted;
}
