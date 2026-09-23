import { create } from 'zustand';

import { CURRENT_USER_ID, mockUsers, User } from '../mocks/presence';

// バックエンド未接続の段階でUIを動かすための仮の状態管理（他のUSと同じ方針、
// docs/architecture.md参照）。USERS.is_anonymousの切り替えを保持し、
// Supabase接続後はusersテーブルのupdateに置き換える想定（US-013）
type AnonymousModeState = {
  users: User[];
  isAnonymous: boolean;
  toggle: () => void;
};

export const useAnonymousModeStore = create<AnonymousModeState>((set, get) => ({
  users: mockUsers,
  isAnonymous: mockUsers.find((user) => user.id === CURRENT_USER_ID)?.is_anonymous ?? false,

  toggle: () => {
    const nextValue = !get().isAnonymous;
    set({
      isAnonymous: nextValue,
      users: get().users.map((user) =>
        user.id === CURRENT_USER_ID ? { ...user, is_anonymous: nextValue } : user
      ),
    });
  },
}));
