import { Friendship } from '../mocks/presence';

// 友達の入室を通知してよいか判定する（US-007・US-008・US-016・US-017）。
//
// Issue #270で判定ルールを統合：
// notify_enabled AND NOT muted AND (want_to_meet OR 自分も同じエリアに在席中)
// （docs/schema.md「FRIENDSHIPS」2026-10-02更新箇所参照）。
//
// 「共在時のみ通知」（旧notify_only_when_copresentトグル、US-016）は個別トグル
// ではなく常時適用のルールに統合され、その列自体を廃止した。want_to_meet
// （US-017）は独立した別ルールとして残り、共在していなくても通知する役割に
// 専念する。優先度はmuted（最優先）→want_to_meetの順。
//
// 注意：notify_enabledとmutedは、どちらも「friendshipの行の持ち主が
// friend_idに対して設定した値」という同じ形の行から読む前提。実際の通知
// 送信を実装する際は、送信者（入室した本人）の行のnotify_enabledと、
// 受信者（通知を受け取る側）の行のmutedは別々の行になる点に注意する
// （呼び出し側で正しい行を組み合わせて渡すこと）
//
// isRecipientPresentInSameAreaは、呼び出し側が「受信者が、入室したエリアに
// 在席中か」を判定して渡す（PRESENCE_LOGS参照。この関数自体は在席判定
// ロジックを持たない）。
//
// Issue #360：USERS.allow_entry_notifications（US-017専用の個別許可設定）は
// 廃止した。この設定でカバーしていた「通知を止めたい」ケースは匿名モード
// （Issue #352）で代替できるため、常に許可されている前提にする
// （DBカラム自体は削除せず、ロジックから参照しないだけ）。
//
// enteringUserIsAnonymousは、入室した本人のUSERS.is_anonymous（US-013、
// 匿名モード）。trueの間は、docs/schema.mdの定義（友達に対して名前だけでなく
// 在席も非表示にする）通り、want_to_meetや共在の有無に関わらず誰にも通知を
// 送ってはいけない（Issue #352）ため、他のどの条件よりも先に判定する
export function shouldSendEntryNotification(
  friendship: Friendship,
  isRecipientPresentInSameArea: boolean,
  enteringUserIsAnonymous: boolean
): boolean {
  if (enteringUserIsAnonymous) {
    return false;
  }
  if (!friendship.notify_enabled || friendship.muted) {
    return false;
  }
  if (isRecipientPresentInSameArea) {
    return true;
  }
  return friendship.want_to_meet;
}
