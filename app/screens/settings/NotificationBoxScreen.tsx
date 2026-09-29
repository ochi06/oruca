import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatTime } from '../../utils/format';
import { useArrivalSummaryStore } from '../../store/useArrivalSummaryStore';
import { SettingsStackParamList } from '../../navigation/types';

// 中身は入室時の会える人一覧（US-021、Issue #16）のみ実装済み。
// グループ招待の承諾（Issue #117）は友達・グループタブの独立画面
// （GroupJoinScreen）として実装済みのため、ここには含まれていない
type Props = NativeStackScreenProps<SettingsStackParamList, 'NotificationBox'>;

export default function NotificationBoxScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const summaries = useArrivalSummaryStore((state) => state.summaries);

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>通知ボックス</Text>

      {summaries.length === 0 ? (
        <EmptyState icon="notifications-outline" message="通知はありません" />
      ) : (
        summaries.map((summary) => (
          <View key={summary.id} style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {summary.areaName}に入室しました（{formatTime(new Date(summary.enteredAt))}）
            </Text>
            {summary.meetableUsers.length === 0 ? (
              <Text style={{ color: colors.textSub }}>今会える友達・グループメンバーはいません</Text>
            ) : (
              <>
                <Text style={{ color: colors.textSub }}>今会える人</Text>
                {summary.meetableUsers.map((user) => (
                  <ListItem
                    key={user.userId}
                    title={user.displayName}
                    leading={<Avatar name={user.displayName} iconUrl={user.iconUrl} />}
                  />
                ))}
              </>
            )}
          </View>
        ))
      )}

      <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton} />
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
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  backButton: {
    marginTop: spacing.md,
  },
});
