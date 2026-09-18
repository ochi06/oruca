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
  iconUrl: string | null; // 承認済みでなければ null（名前と同じ理由で非表示にする）
  isPresent: boolean;
};

type DerivedPresenceState = {
  areaName: string;
  friends: FriendPresence[];
  presentCount: number; // エリア内の在席者全体の人数（友達に限らない、docs/oruca_PRD.md「在席可視化」参照）
};

type PresenceState = DerivedPresenceState & {
  presenceLogs: PresenceLog[];
  // US-004（ジオフェンス判定）が入退室を検知した際に呼ぶ想定のaction。
  // 渡されたlogsからfriends・presentCountを再計算し、この画面（US-001）にも反映する
  setPresenceLogs: (logs: PresenceLog[]) => void;
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
  currentUserId: string,
  friendId: string,
  areaId: string,
  friendAreaLinks: FriendAreaLink[],
  users: User[]
): string | null {
  // FRIEND_AREA_LINKSはinitiator_id/friend_idを持つ方向付きの行なので、
  // 自分が提案した場合・友達が提案した場合の両方を確認する必要がある
  const approvedLink = friendAreaLinks.find(
    (link) =>
      link.status === 'approved' &&
      link.area_id === areaId &&
      ((link.initiator_id === currentUserId && link.friend_id === friendId) ||
        (link.initiator_id === friendId && link.friend_id === currentUserId))
  );
  if (approvedLink === undefined) {
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
): DerivedPresenceState {
  
  const friendIds = friendships
    .filter((f) => f.user_id === currentUserId && f.status === 'active')
    .map((f) => f.friend_id);

  const friends: FriendPresence[] = friendIds.map((friendId) => {
    const isPresent = presenceLogs.some(
      (log) => log.user_id === friendId && log.area_id === area.id && log.exited_at === null
    );
    const displayName = resolveDisplayName(currentUserId, friendId, area.id, friendAreaLinks, users);
    const iconUrl =
      displayName === null ? null : users.find((user) => user.id === friendId)?.icon_url ?? null;
    return { userId: friendId, displayName, iconUrl, isPresent };
  });

  // 在席人数はエリア内の在席者全体が対象（友達に限らない）。
  // 同じ人が複数のPRESENCE_LOGSを持つことは無い前提だが、念のためuser_idで重複排除する
  const presentUserIds = new Set(
    presenceLogs
      .filter((log) => log.area_id === area.id && log.exited_at === null)
      .map((log) => log.user_id)
  );
  const presentCount = presentUserIds.size;

  return { areaName: area.name, friends, presentCount };
}

export type PresenceLocation = {
  user_id: string;
  lat: number | null;
  lng: number | null;
};

export type PresenceMarker = {
  userId: string;
  latitude: number;
  longitude: number;
  displayName: string | null; // nullの場合、画面側では色つきドットのみ表示する
  iconUrl: string | null;
};

// Issue #58：マップ上に表示するマーカー情報を組み立てる。
// 「誰の名前・アイコンを見せてよいか」はvisibleUserIds（呼び出し側が
// resolveDisplayNameなどで判定した結果）で受け取る形にし、この関数自体は
// 可視性の判定ロジックを持たない（テスト・呼び出し側の判断基準の差し替えを
// しやすくするため）。自分自身は常に表示する
export function buildPresenceMarkers(
  currentUserId: string,
  presenceLocations: PresenceLocation[],
  visibleUserIds: Set<string>,
  users: User[]
): PresenceMarker[] {
  return presenceLocations
    .filter((location): location is PresenceLocation & { lat: number; lng: number } =>
      location.lat !== null && location.lng !== null
    )
    .map((location) => {
      const isVisible = location.user_id === currentUserId || visibleUserIds.has(location.user_id);
      const user = users.find((u) => u.id === location.user_id);
      return {
        userId: location.user_id,
        latitude: location.lat,
        longitude: location.lng,
        displayName: isVisible ? user?.name ?? null : null,
        iconUrl: isVisible ? user?.icon_url ?? null : null,
      };
    });
}

export const usePresenceStore = create<PresenceState>((set) => ({
  ...buildInitialState(
    CURRENT_USER_ID,
    mockFriendships,
    mockPresenceLogs,
    mockFriendAreaLinks,
    mockUsers,
    presenceArea
  ),
  presenceLogs: mockPresenceLogs,
  setPresenceLogs: (logs) =>
    set({
      ...buildInitialState(
        CURRENT_USER_ID,
        mockFriendships,
        logs,
        mockFriendAreaLinks,
        mockUsers,
        presenceArea
      ),
      presenceLogs: logs,
    }),
}));
