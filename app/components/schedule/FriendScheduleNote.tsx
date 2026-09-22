import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useScheduleStore } from '../../store/useScheduleStore';

type Props = {
  friendId: string;
  areaId: string;
};

// 友達1人分の滞在予定表示（US-011）。友達詳細画面（Issue #114でreact-navigation
// 本導入後に配置）から埋め込んで使う想定の単体コンポーネント。ナビゲーション
// 構成が固まるまでは、まだどの画面からも呼び出されていない
export function FriendScheduleNote({ friendId, areaId }: Props) {
  const { colors } = useTheme();
  const schedule = useScheduleStore((state) => state.friendSchedule(friendId, areaId));

  if (schedule.note === null) {
    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.text }]}>滞在予定</Text>
        <Text style={{ color: colors.textSub }}>非公開</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>滞在予定</Text>
      <Text style={{ color: colors.text }}>{schedule.note}</Text>
      {schedule.overrideNote && (
        <Text style={{ color: colors.textSub }}>今日：{schedule.overrideNote}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
});
