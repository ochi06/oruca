import { create } from 'zustand';

import { Friendship, mockFriendships } from '../mocks/presence';

// バックエンド未接続の段階でUIを動かすための仮の状態管理（他のUSと同じ方針、
// docs/architecture.md参照）。friendships.notify_enabledの切り替えを保持し、
// Supabase接続後はfriendshipsテーブルのupdateに置き換える想定
type NotifyPreferencesState = {
  friendships: Friendship[];
  toggleNotifyEnabled: (friendId: string) => void;
  // 特定の相手からの通知をミュートする（US-008、受信側の設定）
  toggleMuted: (friendId: string) => void;
  // 自分がその友達の入室先エリアに在席している時だけ通知を受け取る
  // （US-016、受信側の設定）
  toggleNotifyOnlyWhenCopresent: (friendId: string) => void;
  // この友達を「会いたい人」に登録する。共在していなくても入室通知を
  // 受け取る（US-017、受信側の設定）
  toggleWantToMeet: (friendId: string) => void;
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

  toggleMuted: (friendId) =>
    set((state) => ({
      friendships: state.friendships.map((friendship) =>
        friendship.friend_id === friendId ? { ...friendship, muted: !friendship.muted } : friendship
      ),
    })),

  toggleNotifyOnlyWhenCopresent: (friendId) =>
    set((state) => ({
      friendships: state.friendships.map((friendship) =>
        friendship.friend_id === friendId
          ? { ...friendship, notify_only_when_copresent: !friendship.notify_only_when_copresent }
          : friendship
      ),
    })),

  toggleWantToMeet: (friendId) =>
    set((state) => ({
      friendships: state.friendships.map((friendship) =>
        friendship.friend_id === friendId
          ? { ...friendship, want_to_meet: !friendship.want_to_meet }
          : friendship
      ),
    })),
}));
