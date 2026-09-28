import { User } from '../mocks/presence';

export type MeetableUser = {
  userId: string;
  displayName: string;
  iconUrl: string | null;
};

// エリアに入室した時、そこで「会える」人（友達 or グループメンバー）を
// まとめて組み立てる（US-021、Issue #16）。presentUserIds（そのエリアに
// 現在在席中の人のuser_id一覧）のうち、friendIds・groupMateIdsのどちらかに
// 含まれる人だけを対象にする。自分自身はpresentUserIdsに含めない前提
// （呼び出し側でフィルタ済みのものを渡す）
export function buildMeetableUsers(
  presentUserIds: string[],
  friendIds: Set<string>,
  groupMateIds: Set<string>,
  users: User[]
): MeetableUser[] {
  return presentUserIds
    .filter((userId) => friendIds.has(userId) || groupMateIds.has(userId))
    .map((userId) => users.find((user) => user.id === userId))
    .filter((user): user is User => user !== undefined)
    .map((user) => ({ userId: user.id, displayName: user.name, iconUrl: user.icon_url }));
}
