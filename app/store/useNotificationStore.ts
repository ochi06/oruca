import { create } from 'zustand';

import { Notification } from '../mocks/notifications';
import * as notificationsApi from '../lib/notifications';

type NotificationState = {
  notifications: Notification[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  initialize: () => Promise<void>;
  // group_invite通知は、GROUPS/GROUP_MEMBERSがまだ実Supabase接続されていない
  // （Issue #144）ため、サーバー側（Edge Function等）でNOTIFICATIONS行を
  // 作成する仕組みがまだ無い。#144接続後に別Issueでサーバー側生成に置き換える
  // までの暫定として、呼び出し側からローカルにだけ追加できるようにしておく
  // （このstateの正はSupabase側のため、次にinitialize()すると消える）
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => Promise<void>;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  status: 'idle',
  errorMessage: null,

  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', errorMessage: null });
    try {
      const notifications = await notificationsApi.fetchMyNotifications();
      set({ notifications, status: 'ready' });
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : '通知の取得に失敗しました' });
    }
  },

  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),

  markAsRead: async (notificationId) => {
    const previous = get().notifications;
    set({
      notifications: previous.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    });
    try {
      await notificationsApi.markNotificationAsRead(notificationId);
    } catch (error) {
      set({ notifications: previous });
      throw error;
    }
  },
}));
