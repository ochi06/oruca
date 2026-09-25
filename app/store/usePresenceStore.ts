import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Area } from '../mocks/areas';
import { Friendship, FriendAreaLink, PresenceLog, User } from '../mocks/presence';
import { UserStatus } from '../constants/status';

export type FriendPresence = {
  userId: string;
  displayName: string | null; // 承認済みでなければ null（画面側で「非公開」表示）
  iconUrl: string | null; // 承認済みでなければ null（名前と同じ理由で非表示にする）
  status: UserStatus | null; // 承認済みでなければ null（名前・アイコンと同じ理由、Issue #10）
  isPresent: boolean;
};

type DerivedPresenceState = {
  areaName: string;
  friends: FriendPresence[];
  presentCount: number; // エリア内の在席者全体の人数（友達に限らない、docs/oruca_PRD.md「在席可視化」参照）
};

type PresenceStatus = 'idle' | 'loading' | 'ready' | 'error';

type PresenceState = DerivedPresenceState & {
  presenceLogs: PresenceLog[];
  status: PresenceStatus;
  errorMessage: string | null;
  // US-004（ジオフェンス判定）が入退室を検知した際に呼ぶ想定のaction。
  // 渡されたlogsからfriends・presentCountを再計算し、この画面（US-001）にも反映する
  setPresenceLogs: (logs: PresenceLog[]) => void;
  // Supabaseから自分の監視エリア・友達・在席ログを取得し、Realtime購読を開始する
  initialize: () => Promise<void>;
};

// 「友達が対象エリアで名前つき表示してよいか」を判定する関数。
//
// 守るべき条件（docs/schema.md「設計上の重要な原則」2. を参照）：
// - PRESENCE_LOGS だけを見て名前を出してはいけない
// - 必ず FRIEND_AREA_LINKS.status === 'approved' な行が、
//   対象の friendId × areaId の組み合わせで存在する場合のみ名前を返す
// - 承認されている場合は users から friendId の name を探して返す
// - 承認されていない場合は null を返す（呼び出し側は null なら「非公開」と表示する）
// - US-013：friendがis_anonymous（匿名モードON）の場合は、承認済みでも
//   name は返さない（FRIEND_AREA_LINKSの承認より匿名モードが優先される）
//
// friendAreaLinks・users を引数で受け取る形にしているのは、単体テストで
// 好きなデータを渡して検証できるようにするため（Supabaseから取得した
// データをそのまま渡す形で本番実装でも使う）。
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
  if (friend === undefined || friend.is_anonymous) {
    return null;
  }
  return friend.name;
}

// 取得したデータ（friendships・presenceLogs・friendAreaLinks・users・area）から
// PresenceState を組み立てる。
//
// 手順：
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
    const friendUser = users.find((user) => user.id === friendId);
    // US-013：匿名モード中の友達は、名前だけでなく在席（isPresent）も
    // 完全に非表示にする（開発者確認済み。一覧全体の在席人数presentCountには
    // 影響しない。あくまで「友達から見えるかどうか」だけを変える）
    const isPresent =
      !friendUser?.is_anonymous &&
      presenceLogs.some(
        (log) => log.user_id === friendId && log.area_id === area.id && log.exited_at === null
      );
    const displayName = resolveDisplayName(currentUserId, friendId, area.id, friendAreaLinks, users);
    const iconUrl = displayName === null ? null : friendUser?.icon_url ?? null;
    const status = displayName === null ? null : friendUser?.status ?? null;
    return { userId: friendId, displayName, iconUrl, status, isPresent };
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
  status: UserStatus | null; // 承認済みでなければnull（名前・アイコンと同じ理由）
};

// Issue #120：エリアタップのポップアップ・フルリストで使う「そのエリアの在席者」1人分。
// buildPresenceMarkersと同じ可視性ルール（RLSで返ってきたusers＝承認済みの相手か自分自身
// のみ名前・アイコン・ステータスを見せる）を適用した結果を表す
export type AreaPresentUser = {
  userId: string;
  displayName: string | null;
  iconUrl: string | null;
  status: UserStatus | null;
};

// あるエリアに在席中のuserId一覧から、AreaPresentUser[]を組み立てる（Issue #120）。
// buildPresenceMarkersと同じvisibleUserIds（RLSで返ってきたusersから決めた
// 「名前を見せてよい相手」の集合）を受け取る形にして、可視性判定ロジックを重複させない
export function buildAreaPresentUsers(
  currentUserId: string,
  areaUserIds: string[],
  visibleUserIds: Set<string>,
  users: User[]
): AreaPresentUser[] {
  return areaUserIds.map((userId) => {
    const isVisible = userId === currentUserId || visibleUserIds.has(userId);
    const user = users.find((u) => u.id === userId);
    return {
      userId,
      displayName: isVisible ? user?.name ?? null : null,
      iconUrl: isVisible ? user?.icon_url ?? null : null,
      status: isVisible ? user?.status ?? null : null,
    };
  });
}

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
  // 同じuser_idが複数のエリアに同時在席している場合（エリアが重なっている等）、
  // presenceLocationsに同じuser_idの行が複数含まれうる。地図上では1人1マーカーに
  // なるべきなので、最初の1件だけを採用して重複を防ぐ（Issue #127）
  const seenUserIds = new Set<string>();

  return presenceLocations
    .filter((location): location is PresenceLocation & { lat: number; lng: number } =>
      location.lat !== null && location.lng !== null
    )
    .filter((location) => {
      if (seenUserIds.has(location.user_id)) return false;
      seenUserIds.add(location.user_id);
      return true;
    })
    .map((location) => {
      const isVisible = location.user_id === currentUserId || visibleUserIds.has(location.user_id);
      const user = users.find((u) => u.id === location.user_id);
      return {
        userId: location.user_id,
        latitude: location.lat,
        longitude: location.lng,
        displayName: isVisible ? user?.name ?? null : null,
        iconUrl: isVisible ? user?.icon_url ?? null : null,
        status: isVisible ? user?.status ?? null : null,
      };
    });
}

// initialize()で取得したデータのうち、setPresenceLogs・Realtime更新のたびに
// buildInitialStateへ渡し直す必要があるものを保持しておく（Zustandの状態には含めない。
// 画面には不要な内部データのため）
type FetchedContext = {
  currentUserId: string;
  area: Area;
  friendships: Friendship[];
  friendAreaLinks: FriendAreaLink[];
  users: User[];
};

let context: FetchedContext | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

async function fetchMonitoredArea(userId: string): Promise<Area | null> {
  // 現状は画面が単一エリアの表示にしか対応していないため、最初に参加した
  // エリア（USER_AREAS.created_atが最も古い行）のみを対象とする
  const { data: userAreas, error: userAreasError } = await supabase
    .from('user_areas')
    .select('area_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (userAreasError) throw userAreasError;

  const areaId = userAreas?.[0]?.area_id;
  if (!areaId) return null;

  const { data: area, error: areaError } = await supabase
    .from('areas')
    .select('*')
    .eq('id', areaId)
    .single();
  if (areaError) throw areaError;
  return area as Area;
}

async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as Friendship[];
}

async function fetchFriendAreaLinks(areaId: string): Promise<FriendAreaLink[]> {
  const { data, error } = await supabase
    .from('friend_area_links')
    .select('*')
    .eq('area_id', areaId)
    .eq('status', 'approved');
  if (error) throw error;
  return (data ?? []) as FriendAreaLink[];
}

// friendIdsのうち、RLS上読めるusers行（＝FRIEND_AREA_LINKSが承認済みの相手、
// または自分自身）だけが返る
async function fetchUsers(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.from('users').select('*').in('id', userIds);
  if (error) throw error;
  return (data ?? []) as User[];
}

async function fetchOpenPresenceLogs(areaId: string): Promise<PresenceLog[]> {
  const { data, error } = await supabase
    .from('presence_logs')
    .select('*')
    .eq('area_id', areaId)
    .is('exited_at', null);
  if (error) throw error;
  return (data ?? []) as PresenceLog[];
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  areaName: '',
  friends: [],
  presentCount: 0,
  presenceLogs: [],
  status: 'idle',
  errorMessage: null,

  setPresenceLogs: (logs) => {
    if (!context) {
      set({ presenceLogs: logs });
      return;
    }
    set({
      ...buildInitialState(
        context.currentUserId,
        context.friendships,
        logs,
        context.friendAreaLinks,
        context.users,
        context.area
      ),
      presenceLogs: logs,
    });
  },

  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', errorMessage: null });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id;
      if (!currentUserId) {
        throw new Error('ログインが完了していません');
      }

      const area = await fetchMonitoredArea(currentUserId);
      if (!area) {
        context = null;
        set({ areaName: '', friends: [], presentCount: 0, presenceLogs: [], status: 'ready' });
        return;
      }

      const [friendships, friendAreaLinks, presenceLogs] = await Promise.all([
        fetchFriendships(currentUserId),
        fetchFriendAreaLinks(area.id),
        fetchOpenPresenceLogs(area.id),
      ]);

      const friendIds = friendships.map((f) => f.friend_id);
      const users = await fetchUsers(friendIds);

      context = { currentUserId, area, friendships, friendAreaLinks, users };

      set({
        ...buildInitialState(currentUserId, friendships, presenceLogs, friendAreaLinks, users, area),
        presenceLogs,
        status: 'ready',
      });

      realtimeChannel?.unsubscribe();
      realtimeChannel = supabase
        .channel(`presence_logs:area:${area.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'presence_logs', filter: `area_id=eq.${area.id}` },
          async () => {
            try {
              const latestLogs = await fetchOpenPresenceLogs(area.id);
              get().setPresenceLogs(latestLogs);
            } catch {
              // Realtime再取得の失敗は画面を壊さず無視する（次のイベントで再試行される）
            }
          }
        )
        .subscribe();
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '在席情報の取得に失敗しました',
      });
    }
  },
}));
