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
// US-016（Issue #14）：notify_only_when_copresentがtrueの間は、通知の受信者
// （friendshipの行の持ち主）が、入室した友達と同じエリアに在席している時だけ
// 通知する。isRecipientPresentInSameAreaは、呼び出し側が「受信者が、入室した
// エリアに在席中か」を判定して渡す（PRESENCE_LOGS参照。この関数自体は
// 在席判定ロジックを持たない）
export function shouldSendEntryNotification(
  friendship: Friendship,
  isRecipientPresentInSameArea: boolean
): boolean {
  if (!friendship.notify_enabled || friendship.muted) {
    return false;
  }
  if (friendship.notify_only_when_copresent && !isRecipientPresentInSameArea) {
    return false;
  }
  return true;
}

// US-017（Issue #15）：「会いたい人」通知。友達を会いたい人として登録している
// （friendship.want_to_meetがtrue）間は、共在していなくても入室通知を受け取れる
// （notify_only_when_copresentの制限を上書きする）。
//
// これはshouldSendEntryNotification（通常の入室通知、友達ごとのnotify_enabledに
// 依存）とは別の独立した通知経路。会いたい人登録は誰にでもできてよく、実際に
// 通知が届くかどうかは、入室した本人がアカウント全体で設定する
// USERS.allow_entry_notifications（enteringUserAllowsEntryNotifications）
// 次第、という設計（2026-09-24、開発者確認済み）。
//
// 優先度：muted（受信者がこの友達をミュートしている）が最優先で、
// mutedがtrueなら他の条件に関わらず通知しない。
export function shouldSendWantToMeetNotification(
  friendship: Friendship,
  enteringUserAllowsEntryNotifications: boolean
): boolean {
  if (friendship.muted) {
    return false;
  }
  if (!friendship.want_to_meet) {
    return false;
  }
  return enteringUserAllowsEntryNotifications;
}
