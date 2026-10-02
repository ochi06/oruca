import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScheduleEditForm } from '../../components/schedule/ScheduleEditForm';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { SettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ScheduleEdit'>;

// ScheduleAreaListScreenで選んだエリア1件分の滞在予定編集画面（Issue #244、US-011）。
// 実際の入力フォーム（基本の滞在予定・今日だけの予定変更）は既存の
// ScheduleEditFormにそのまま委譲する
export default function ScheduleEditScreen({ route, navigation }: Props) {
  const { areaId, areaName } = route.params;
  const { colors } = useTheme();

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <Text style={[styles.title, { color: colors.text }]}>{areaName}</Text>
      <ScheduleEditForm areaId={areaId} />
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
});
