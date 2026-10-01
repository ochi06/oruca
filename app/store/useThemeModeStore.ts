import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeModeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

// 表示モード（ライト/ダーク/システムに従う）の選択をAsyncStorageに永続化する（Issue #130）
export const useThemeModeStore = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'oruca-theme-mode',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
