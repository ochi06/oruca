import { create } from 'zustand';

import { ensureSignedIn } from '../lib/auth';
import {
  fetchFriendships,
  fetchUsersByIds,
  updateFriendshipMuted,
  updateFriendshipNotifyEnabled,
  updateFriendshipNotifyOnlyWhenCopresent,
  updateFriendshipWantToMeet,
  updateFriendshipLocationHidden,
} from '../lib/friends';
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
  toggleNotifyEnabled: (friendId: string) => Promise<void>;
  // 特定の相手からの通知をミュートする（US-008、受信側の設定）
  toggleMuted: (friendId: string) => Promise<void>;
  // 自分がその友達の入室先エリアに在席している時だけ通知を受け取る
  // （US-016、受信側の設定）
  toggleNotifyOnlyWhenCopresent: (friendId: string) => Promise<void>;
  // この友達を「会いたい人」に登録する。共在していなくても入室通知を
  // 受け取る（US-017、受信側の設定）
  toggleWantToMeet: (friendId: string) => Promise<void>;
  // この友達に自分の位置情報（presence_logs）を見せない（Issue #121、
  // 一方向ブロック。他の3つと違い「情報を隠す側」の設定）
  toggleLocationHidden: (friendId: string) => Promise<void>;
};

// 楽観的更新→永続化を行う共通ヘルパー。永続化に失敗した場合は表示を戻す
async function toggleField<K extends keyof Friendship>(
  get: () => NotifyPreferencesState,
  set: (partial: Partial<NotifyPreferencesState>) => void,
  friendId: string,
  field: K,
  persist: (userId: string, friendId: string, nextValue: boolean) => Promise<void>
): Promise<void> {
  const { currentUserId, friendships } = get();
  const target = friendships.find((f) => f.friend_id === friendId);
  if (!currentUserId || !target) return;

  const nextValue = !(target[field] as unknown as boolean);
  const apply = (value: boolean) =>
    set({
      friendships: get().friendships.map((f) =>
        f.friend_id === friendId ? { ...f, [field]: value } : f
      ),
    });

  apply(nextValue);
  try {
    await persist(currentUserId, friendId, nextValue);
  } catch {
    apply(!nextValue);
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
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '友達一覧の取得に失敗しました',
      });
    }
  },

  toggleNotifyEnabled: (friendId) =>
    toggleField(get, set, friendId, 'notify_enabled', updateFriendshipNotifyEnabled),

  toggleMuted: (friendId) => toggleField(get, set, friendId, 'muted', updateFriendshipMuted),

  toggleNotifyOnlyWhenCopresent: (friendId) =>
    toggleField(
      get,
      set,
      friendId,
      'notify_only_when_copresent',
      updateFriendshipNotifyOnlyWhenCopresent
    ),

  toggleWantToMeet: (friendId) =>
    toggleField(get, set, friendId, 'want_to_meet', updateFriendshipWantToMeet),

  toggleLocationHidden: (friendId) =>
    toggleField(get, set, friendId, 'location_hidden', updateFriendshipLocationHidden),
}));
