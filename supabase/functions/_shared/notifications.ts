// app/utils/notifications.ts の判定ロジックをEdge Function（Deno）向けに移植したもの。
// クライアント（Expo/React Native）とEdge Function（Deno）は別ランタイムで、
// このプロジェクトには両者が共有できるビルド構成がまだ無いため、いったん
// 同じロジックを2箇所に複製している（Issue #131）。判定ルールを変更する際は
// app/utils/notifications.ts と両方を更新すること（app側のテストが
// このロジックの正しさを担保する）。

export type FriendshipRow = {
  notify_enabled: boolean;
  muted: boolean;
  notify_only_when_copresent: boolean;
  want_to_meet: boolean;
};

export function shouldSendEntryNotification(
  friendship: FriendshipRow,
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

export function shouldSendWantToMeetNotification(
  friendship: FriendshipRow,
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
