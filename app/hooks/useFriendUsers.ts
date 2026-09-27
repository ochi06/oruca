import { CURRENT_USER_ID, mockUsers, User } from '../mocks/presence';
import { otherUser } from '../mocks/otp';
import { useFriendAddStore } from '../store/useFriendAddStore';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';

// 自分の友達一覧をUser[]で返す（FriendsListScreenとグループ招待画面の
// 両方で使うため切り出した）。バックエンド未接続のため、friendships
// （useNotifyPreferencesStore）とOTP追加済みID（useFriendAddStore）を
// 突き合わせてモックユーザーから引く
export function useFriendUsers(): User[] {
  const addedFriendIds = useFriendAddStore((state) => state.addedFriendIds);
  const friendships = useNotifyPreferencesStore((state) => state.friendships);

  const friendIds = friendships
    .filter((f) => f.user_id === CURRENT_USER_ID && f.status === 'active')
    .map((f) => f.friend_id);
  const allUsers = [...mockUsers, otherUser];

  return [...friendIds, ...addedFriendIds]
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((id) => allUsers.find((user) => user.id === id))
    .filter((user): user is User => user !== undefined);
}
