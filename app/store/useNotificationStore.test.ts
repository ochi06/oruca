import { useNotificationStore } from './useNotificationStore';
import { Notification } from '../mocks/notifications';

const now = '2026-09-19T00:00:00.000Z';

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notification-test-1',
    user_id: 'user-me',
    type: 'entry',
    related_user_id: 'user-a',
    area_id: 'area-1',
    group_member_id: null,
    is_read: false,
    created_at: now,
    ...overrides,
  };
}

describe('useNotificationStore', () => {
  it('初期状態でarrival_summary・group_invite・entry・want_to_meetの通知を持つ', () => {
    const types = useNotificationStore.getState().notifications.map((n) => n.type);

    expect(types).toEqual(expect.arrayContaining(['arrival_summary', 'group_invite', 'entry', 'want_to_meet']));
  });

  describe('addNotification', () => {
    it('先頭に新しい通知を追加する', () => {
      const before = useNotificationStore.getState().notifications;
      const newNotification = buildNotification({ id: 'notification-new' });

      useNotificationStore.getState().addNotification(newNotification);

      const after = useNotificationStore.getState().notifications;
      expect(after[0]).toEqual(newNotification);
      expect(after).toHaveLength(before.length + 1);
    });
  });

  describe('markAsRead', () => {
    it('指定した通知のis_readをtrueにする', () => {
      useNotificationStore.setState({ notifications: [buildNotification({ id: 'notification-x', is_read: false })] });

      useNotificationStore.getState().markAsRead('notification-x');

      expect(useNotificationStore.getState().notifications[0].is_read).toBe(true);
    });

    it('該当しないidを渡しても他の通知に影響しない', () => {
      const notification = buildNotification({ id: 'notification-y', is_read: false });
      useNotificationStore.setState({ notifications: [notification] });

      useNotificationStore.getState().markAsRead('notification-unknown');

      expect(useNotificationStore.getState().notifications[0].is_read).toBe(false);
    });
  });
});
