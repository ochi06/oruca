import { create } from 'zustand';
import { Area } from '../mocks/areas';
import {
  CURRENT_USER_ID,
  Friendship,
  FriendAreaLink,
  PresenceLog,
  User,
  mockFriendAreaLinks,
  mockFriendships,
  mockPresenceLogs,
  mockUsers,
  presenceArea,
} from '../mocks/presence';

export type FriendPresence = {
  userId: string;
  displayName: string | null; // 承認済みでなければ null（画面側で「非公開」表示）
  isPresent: boolean;
};

type PresenceState = {
  areaName: string;
  friends: FriendPresence[];
  presentCount: number; // friends のうち isPresent===true の人数（友達のみが対象）
};

// TODO(開発者): 「友達が対象エリアで名前つき表示してよいか」を判定する関数。
//
// 守るべき条件（docs/schema.md「設計上の重要な原則」2. を参照）：
// - PRESENCE_LOGS だけを見て名前を出してはいけない
// - 必ず FRIEND_AREA_LINKS.status === 'approved' な行が、
//   対象の friendId × areaId の組み合わせで存在する場合のみ名前を返す
// - 承認されている場合は users から friendId の name を探して返す
// - 承認されていない場合は null を返す（呼び出し側は null なら「非公開」と表示する）
//
// friendAreaLinks・users を引数で受け取る形にしているのは、単体テストで
// 好きなデータを渡して検証できるようにするため（本番実装でも、Supabaseから
// 取得したデータをそのまま渡す形に置き換えられる）。
//
// 本番実装（Supabase接続後）でもこの関数はそのまま使う想定なので、
// 「モックだから省略」にしない。
export function resolveDisplayName(
  friendId: string,
  areaId: string,
  friendAreaLinks: FriendAreaLink[],
  users: User[]
): string | null {
  
  const approvedFriends = friendAreaLinks.find((area) => area.status === 'approved' && area.area_id === areaId && area.friend_id === friendId )
  if(approvedFriends === undefined){
    return null;
  }
  const friend = users.find((user) => user.id === friendId);
  return friend === undefined ? null : friend.name;
}

// TODO(開発者): モックデータから PresenceState を組み立てる。
//
// currentUserId・friendships・presenceLogs・friendAreaLinks・users・area を
// 引数で受け取る形にしているのは resolveDisplayName と同じ理由（単体テストで
// 好きなデータパターンを渡して検証できるようにするため）。
//
// 手順の目安：
// 1. friendships から、自分（currentUserId）を起点とする友達の friend_id
//    一覧を取り出す（status === 'active' のもののみ）
// 2. その友達それぞれについて、presenceLogs から area.id に紐づく行を探し、
//    exited_at === null なら在席中（isPresent = true）とする
// 3. resolveDisplayName(friendId, area.id, friendAreaLinks, users) を
//    使って displayName を決める
// 4. friends 配列と、その中で isPresent な人数（presentCount）をまとめて返す
export function buildInitialState(
  currentUserId: string,
  friendships: Friendship[],
  presenceLogs: PresenceLog[],
  friendAreaLinks: FriendAreaLink[],
  users: User[],
  area: Area
): PresenceState {
  
  const friendIds = friendships
    .filter((f) => f.user_id === currentUserId && f.status === 'active')
    .map((f) => f.friend_id);

  const friends: FriendPresence[] = friendIds.map((friendId) => {
    const isPresent = presenceLogs.some(
      (log) => log.user_id === friendId && log.area_id === area.id && log.exited_at === null
    );
    const displayName = resolveDisplayName(friendId, area.id, friendAreaLinks, users);
    return { userId: friendId, displayName, isPresent };
  });

  const presentCount = friends.filter((f) => f.isPresent).length;

  return { areaName: area.name, friends, presentCount };
}

export const usePresenceStore = create<PresenceState>(() =>
  buildInitialState(
    CURRENT_USER_ID,
    mockFriendships,
    mockPresenceLogs,
    mockFriendAreaLinks,
    mockUsers,
    presenceArea
  )
);
