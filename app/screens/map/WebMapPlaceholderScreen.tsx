import { StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// Issue #190: Web簡易体験版向け。react-native-mapsがWeb非対応のため、
// マップタブはこの案内画面に差し替える（エリア登録・管理もWeb版では未対応）。
// グループの在席者一覧はグループ詳細画面（友達・グループタブ）からリスト形式で
// 確認できる
export default function WebMapPlaceholderScreen() {
  const { colors } = useTheme();

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>マップ機能はこの簡易版では利用できません</Text>
      <Text style={[styles.body, { color: colors.textSub }]}>
        「友達・グループ」タブからオープングループに参加すると、そのグループの詳細画面で
        在席者一覧をリスト形式で確認できます。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
  },
});
