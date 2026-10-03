import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AnnouncementsSeenState = {
  lastSeenId: string | null;
  markSeen: (id: string) => void;
};

// Issue #422: お知らせの既読管理はDBで持たず、「最後に見たお知らせのid」だけを
// 端末ローカルに保持する簡易方式（developer確認済み）。
// useOnboardingStore（Issue #246）と同じpersistパターン
export const useAnnouncementsSeenStore = create<AnnouncementsSeenState>()(
  persist(
    (set) => ({
      lastSeenId: null,
      markSeen: (id) => set({ lastSeenId: id }),
    }),
    {
      name: 'oruca-announcements-seen',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
