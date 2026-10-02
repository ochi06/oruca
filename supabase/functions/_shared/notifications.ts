// app/utils/notifications.ts の判定ロジックをEdge Function（Deno）向けに移植したもの。
// クライアント（Expo/React Native）とEdge Function（Deno）は別ランタイムで、
// このプロジェクトには両者が共有できるビルド構成がまだ無いため、いったん
// 同じロジックを2箇所に複製している（Issue #131）。判定ルールを変更する際は
// app/utils/notifications.ts と両方を更新すること（app側のテストが
// このロジックの正しさを担保する）。

export type FriendshipRow = {
  notify_enabled: boolean;
  muted: boolean;
  want_to_meet: boolean;
};

// Issue #270：notify_enabled AND NOT muted AND (want_to_meet OR 自分も同じ
// エリアに在席中)に統合。旧notify_only_when_copresent列（「共在時のみ通知」の
// 個別トグル）は廃止し、常時適用のルールにした
export function shouldSendEntryNotification(
  friendship: FriendshipRow,
  isRecipientPresentInSameArea: boolean,
  enteringUserAllowsEntryNotifications: boolean
): boolean {
  if (!friendship.notify_enabled || friendship.muted) {
    return false;
  }
  if (isRecipientPresentInSameArea) {
    return true;
  }
  return friendship.want_to_meet && enteringUserAllowsEntryNotifications;
}
