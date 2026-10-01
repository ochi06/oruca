import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ThemeColors } from './colors';
import { useThemeModeStore } from '../store/useThemeModeStore';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme();
  const mode = useThemeModeStore((state) => state.mode);
  const isDark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}
