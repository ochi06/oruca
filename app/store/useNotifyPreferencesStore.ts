import { create } from 'zustand';

import { Friendship, mockFriendships } from '../mocks/presence';

// バックエンド未接続の段階でUIを動かすための仮の状態管理（他のUSと同じ方針、
// docs/architecture.md参照）。friendships.notify_enabledの切り替えを保持し、
// Supabase接続後はfriendshipsテーブルのupdateに置き換える想定
type NotifyPreferencesState = {
  friendships: Friendship[];
  toggleNotifyEnabled: (friendId: string) => void;
};

export const useNotifyPreferencesStore = create<NotifyPreferencesState>((set) => ({
  friendships: mockFriendships,

  toggleNotifyEnabled: (friendId) =>
    set((state) => ({
      friendships: state.friendships.map((friendship) =>
        friendship.friend_id === friendId
          ? { ...friendship, notify_enabled: !friendship.notify_enabled }
          : friendship
      ),
    })),
}));
