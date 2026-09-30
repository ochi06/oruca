import { create } from 'zustand';

import { Notification } from '../mocks/notifications';
import { CURRENT_USER_ID, mockFriendships, mockPresenceLogs, mockUsers, presenceArea } from '../mocks/presence';
import { mockGroupMembers } from '../mocks/groups';
import { getGroupMateIds } from '../utils/groupAuth';
import { buildMeetableUsers } from '../utils/meetable';

type NotificationState = {
  notifications: Notification[];
  // グループ招待など、実際のアクション発生時に呼ぶ想定（Issue #126）。
  // 入室通知・会いたい人通知（type: 'entry' | 'want_to_meet'）はEdge Function
  // （Issue #131）側で作られる想定のため、現状クライアントからは呼ばれない
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
};

const now = '2026-08-16T09:35:00+09:00';

// FRIENDSHIPS/GROUPSがバックエンド未接続の段階のモック初期表示（US-021、Issue #16）。
// 実際の入室検知とは連動していない。会える人1人につき1行作る方針（Issue #126）
function buildInitialArrivalSummaryNotifications(): Notification[] {
  const presentUserIds = mockPresenceLogs
    .filter((log) => log.area_id === presenceArea.id && log.exited_at === null && log.user_id !== CURRENT_USER_ID)
    .map((log) => log.user_id);
  const friendIds = new Set(
    mockFriendships.filter((f) => f.user_id === CURRENT_USER_ID).map((f) => f.friend_id)
  );
  const groupMateIds = getGroupMateIds(CURRENT_USER_ID, mockGroupMembers);
  const meetableUsers = buildMeetableUsers(presentUserIds, friendIds, groupMateIds, mockUsers);

  return meetableUsers.map((user, index) => ({
    id: `notification-arrival-${index + 1}`,
    user_id: CURRENT_USER_ID,
    type: 'arrival_summary',
    related_user_id: user.userId,
    area_id: presenceArea.id,
    group_member_id: null,
    is_read: false,
    created_at: now,
  }));
}

// mocks/groups.tsの'member-invite-demo'（田中→自分への招待）に対応する
// group_invite通知のデモ表示（Issue #126）
const initialGroupInviteNotifications: Notification[] = [
  {
    id: 'notification-group-invite-1',
    user_id: CURRENT_USER_ID,
    type: 'group_invite',
    related_user_id: mockUsers[1].id,
    area_id: null,
    group_member_id: 'member-invite-demo',
    is_read: false,
    created_at: now,
  },
];

// type: 'entry' / 'want_to_meet' はEdge Function（Issue #131）側で作られる想定で
// クライアントからは作られないため、画面の見た目を確認するためのデモ行のみ用意する
const initialEntryAndWantToMeetNotifications: Notification[] = [
  {
    id: 'notification-entry-1',
    user_id: CURRENT_USER_ID,
    type: 'entry',
    related_user_id: mockUsers[2].id, // 鈴木
    area_id: presenceArea.id,
    group_member_id: null,
    is_read: true,
    created_at: '2026-08-16T08:00:00+09:00',
  },
  {
    id: 'notification-want-to-meet-1',
    user_id: CURRENT_USER_ID,
    type: 'want_to_meet',
    related_user_id: mockUsers[3].id, // 佐藤
    area_id: presenceArea.id,
    group_member_id: null,
    is_read: false,
    created_at: '2026-08-16T09:00:00+09:00',
  },
];

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    ...buildInitialArrivalSummaryNotifications(),
    ...initialGroupInviteNotifications,
    ...initialEntryAndWantToMeetNotifications,
  ],

  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),

  markAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
    })),
}));
