import { useEffect } from 'react';

import { User } from '../mocks/presence';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';

// 自分の友達一覧をUser[]で返す（FriendsListScreenとグループ招待画面の
// 両方で使うため切り出した、Issue #143）。データはuseNotifyPreferencesStoreが
// Supabaseから取得したfriendships・usersを突き合わせて組み立てる。
// どちらの画面が先にマウントされても実データを一度だけ取得すればよいように、
// まだfetchしていない（status: 'idle'）場合はここでinitialize()を呼ぶ
export function useFriendUsers(): User[] {
  const status = useNotifyPreferencesStore((state) => state.status);
  const initialize = useNotifyPreferencesStore((state) => state.initialize);
  const friendships = useNotifyPreferencesStore((state) => state.friendships);
  const users = useNotifyPreferencesStore((state) => state.users);

  useEffect(() => {
    if (status === 'idle') {
      initialize();
    }
  }, [status, initialize]);

  return friendships
    .map((f) => users.find((user) => user.id === f.friend_id))
    .filter((user): user is User => user !== undefined);
}
