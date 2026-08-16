import { RefreshControlProps } from 'react-native';
import { useTheme } from './useTheme';

// FlatList/ScrollViewのRefreshControlに渡す共通スタイル
// （使い方）<FlatList refreshControl={<RefreshControl {...useThemedRefreshControl(refreshing, onRefresh)} />} ... />
export function useThemedRefreshControl(
  refreshing: boolean,
  onRefresh: () => void,
): Partial<RefreshControlProps> {
  const { colors } = useTheme();
  return {
    refreshing,
    onRefresh,
    tintColor: colors.blue,
    colors: [colors.blue],
  };
}
