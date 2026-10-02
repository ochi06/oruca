// FRIEND_AREA_LINKSの提案・承認フローに関する純粋関数群（Issue #221）。
// PRD記載の通り「拒否された提案は、拒否した側からのみ再提案できる」という
// ルールをここで判定する（RLS・DBの一意制約では強制していないため、
// 提案前にアプリ側でチェックする）

import { FriendAreaLink } from '../mocks/presence';

export type FriendAreaLinkState =
  | { kind: 'none' }
  | { kind: 'pending_sent'; link: FriendAreaLink }
  | { kind: 'pending_received'; link: FriendAreaLink }
  | { kind: 'approved'; link: FriendAreaLink }
  // 自分が提案し、相手に拒否された（自分からは再提案できない）
  | { kind: 'rejected_by_them'; link: FriendAreaLink }
  // 相手の提案を自分が拒否した（自分からは再提案できる）
  | { kind: 'rejected_by_me'; link: FriendAreaLink };

// 指定した友達・エリアの組み合わせについて、現在のFRIEND_AREA_LINKSの
// 状態を1つに特定する（該当行は初期スキーマの制約上高々1件のはずだが、
// 複数あれば最新のものを優先する）
export function resolveFriendAreaLinkState(
  links: FriendAreaLink[],
  meId: string,
  friendId: string,
  areaId: string
): FriendAreaLinkState {
  const candidates = links
    .filter(
      (link) =>
        link.area_id === areaId &&
        ((link.initiator_id === meId && link.friend_id === friendId) ||
          (link.initiator_id === friendId && link.friend_id === meId))
    )
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const link = candidates[0];

  if (!link) {
    return { kind: 'none' };
  }
  if (link.status === 'pending') {
    return link.initiator_id === meId
      ? { kind: 'pending_sent', link }
      : { kind: 'pending_received', link };
  }
  if (link.status === 'approved') {
    return { kind: 'approved', link };
  }
  // rejected: 拒否した側（friend_id）が自分なら再提案できる
  return link.friend_id === meId
    ? { kind: 'rejected_by_me', link }
    : { kind: 'rejected_by_them', link };
}

// この状態から新規に提案してよいか（「提案する」ボタンを出してよいか）
export function canProposeFriendAreaLink(state: FriendAreaLinkState): boolean {
  return state.kind === 'none' || state.kind === 'rejected_by_me';
}
