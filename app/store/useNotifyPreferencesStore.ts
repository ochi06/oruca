import { create } from 'zustand';

import { ensureSignedIn } from '../lib/auth';
import { fetchFriendships, fetchUsersByIds, removeFriendship, updateFriendshipField } from '../lib/friends';
import { supabase } from '../lib/supabase';
import { Friendship, User } from '../mocks/presence';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// Issue #143：友達一覧・通知設定を実Supabaseに接続する。友達一覧画面
// （FriendsListScreen）とグループ招待画面（useFriendUsers経由）の両方が
// このstoreのfriendships/usersを参照するため、initialize()はどちらの画面が
// 先にマウントされても一度だけ実データを取得すれば良いようにstatusで
// 多重fetchを防ぐ
type NotifyPreferencesState = {
  currentUserId: string | null;
  friendships: Friendship[];
  users: User[];
  status: LoadStatus;
  errorMessage: string | null;
  initialize: () => Promise<void>;
  // Realtimeで友達のUSERS変更を受けた時に、ローディング表示を出さず
  // usersだけを裏で取得し直す（Issue #424）
  refreshUsers: () => Promise<void>;
  // この友達を「会いたい人」に登録する。共在していなくても入室通知を
  // 受け取る（US-017、受信側の設定）
  toggleWantToMeet: (friendId: string) => Promise<void>;
  // この友達に自分の位置情報（presence_logs）を見せない（Issue #121、
  // 一方向ブロック。他の3つと違い「情報を隠す側」の設定）
  toggleLocationHidden: (friendId: string) => Promise<void>;
  // 友達関係を双方向に解消する（US-008「削除」、Issue #276）。成功したら
  // ローカルのfriendships/usersからも取り除き、一覧に残らないようにする
  removeFriend: (friendId: string) => Promise<void>;
};

type ToggleableField = 'want_to_meet' | 'location_hidden';

// 購読中のチャンネルとその対象friend_id集合。集合が変わらない限り購読を
// 張り直さない（usePresenceStore.tsのIssue #308パターンと同じ方針）
let usersChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribedFriendIdsKey: string | null = null;

// Issue #424：友達のUSERS（name/icon_url）の変更をRealtimeで購読し、
// 既に開いている友達一覧に反映する
function subscribeToFriendUserChanges(friendIds: string[], onChange: () => void): void {
  const key = friendIds.slice().sort().join(',');
  if (key === subscribedFriendIdsKey) return;
  subscribedFriendIdsKey = key;

  usersChannel?.unsubscribe();
  usersChannel = null;
  if (friendIds.length === 0) return;

  usersChannel = supabase
    .channel(`users:friends:${key}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=in.(${friendIds.join(',')})` },
      onChange
    )
    .subscribe();
}

// toggleWantToMeetが5人上限超過で失敗した場合のエラーかどうかを判定する
// （Issue #330）。DBトリガー（enforce_want_to_meet_limit、
// supabase/migrations/20261003020000_want_to_meet_limit_and_reset.sql）が
// 投げるraise exceptionのメッセージで判定する
export function isWantToMeetLimitError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('want_to_meet limit reached')
  );
}

// 楽観的更新→永続化を行う共通ヘルパー。永続化に失敗した場合は表示を戻す。
// rethrow=trueの場合、呼び出し側がエラー内容（例：Issue #330のwant_to_meet
// 5人上限超過）を見てトースト等を出し分けられるよう、失敗時にエラーを
// 投げ直す（location_hiddenは従来通り黙って戻すだけで十分なため既定false）
async function toggleField(
  get: () => NotifyPreferencesState,
  set: (partial: Partial<NotifyPreferencesState>) => void,
  friendId: string,
  field: ToggleableField,
  options: { rethrow?: boolean } = {}
): Promise<void> {
  const { currentUserId, friendships } = get();
  const target = friendships.find((f) => f.friend_id === friendId);
  if (!currentUserId || !target) return;

  const nextValue = !target[field];
  const apply = (value: boolean) =>
    set({
      friendships: get().friendships.map((f) =>
        f.friend_id === friendId ? { ...f, [field]: value } : f
      ),
    });

  apply(nextValue);
  try {
    await updateFriendshipField(currentUserId, friendId, field, nextValue);
  } catch (error) {
    apply(!nextValue);
    if (options.rethrow) {
      throw error;
    }
  }
}

export const useNotifyPreferencesStore = create<NotifyPreferencesState>((set, get) => ({
  currentUserId: null,
  friendships: [],
  users: [],
  status: 'idle',
  errorMessage: null,

  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', errorMessage: null });
    try {
      const currentUserId = await ensureSignedIn();
      const friendships = await fetchFriendships(currentUserId);
      const users = await fetchUsersByIds(friendships.map((f) => f.friend_id));
      set({ currentUserId, friendships, users, status: 'ready' });
      subscribeToFriendUserChanges(
        friendships.map((f) => f.friend_id),
        () => get().refreshUsers()
      );
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '友達一覧の取得に失敗しました',
      });
    }
  },

  refreshUsers: async () => {
    const { friendships } = get();
    try {
      const users = await fetchUsersByIds(friendships.map((f) => f.friend_id));
      set({ users });
    } catch {
      // 失敗しても既存表示のまま（Realtime経由のサイレント更新のため黙って無視する）
    }
  },

  toggleWantToMeet: (friendId) => toggleField(get, set, friendId, 'want_to_meet', { rethrow: true }),

  toggleLocationHidden: (friendId) => toggleField(get, set, friendId, 'location_hidden'),

  removeFriend: async (friendId) => {
    await removeFriendship(friendId);
    set({
      friendships: get().friendships.filter((f) => f.friend_id !== friendId),
      users: get().users.filter((u) => u.id !== friendId),
    });
  },
}));
