import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type OnboardingState = {
  hasSeenOnboarding: boolean;
  // persist自体は非同期（AsyncStorageからの読み込みを待つ）なため、
  // 読み込み完了前にhasSeenOnboardingの初期値（false）で判定してしまうと、
  // 既に見た人にも一瞬オンボーディングが表示されてしまう（Issue #246）。
  // App.tsx側はこれがtrueになるまでローディング表示を維持する
  hasHydrated: boolean;
  markOnboardingSeen: () => void;
  setHasHydrated: (value: boolean) => void;
};

// 初回起動時のオンボーディング表示有無をAsyncStorageに永続化する（Issue #246）。
// useThemeModeStore（Issue #130）と同じpersistパターン
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      hasHydrated: false,
      markOnboardingSeen: () => set({ hasSeenOnboarding: true }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'oruca-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
