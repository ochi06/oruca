import { create } from 'zustand';

import { CURRENT_USER_ID, mockUsers, User } from '../mocks/presence';

// バックエンド未接続の段階でUIを動かすための仮の状態管理（他のUSと同じ方針、
// docs/architecture.md参照）。USERS.allow_entry_notificationsの切り替えを保持し、
// Supabase接続後はusersテーブルのupdateに置き換える想定（US-017）
type EntryNotificationPermissionState = {
  users: User[];
  allowEntryNotifications: boolean;
  toggle: () => void;
};

export const useEntryNotificationPermissionStore = create<EntryNotificationPermissionState>(
  (set, get) => ({
    users: mockUsers,
    allowEntryNotifications:
      mockUsers.find((user) => user.id === CURRENT_USER_ID)?.allow_entry_notifications ?? true,

    toggle: () => {
      const nextValue = !get().allowEntryNotifications;
      set({
        allowEntryNotifications: nextValue,
        users: get().users.map((user) =>
          user.id === CURRENT_USER_ID ? { ...user, allow_entry_notifications: nextValue } : user
        ),
      });
    },
  })
);
