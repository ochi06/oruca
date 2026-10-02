import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useScheduleStore } from '../../store/useScheduleStore';

type Props = {
  friendId: string;
  areaId: string;
};

// 友達1人分の滞在予定表示（US-011）。Issue #242でFriendDetailScreenに配線した
export function FriendScheduleNote({ friendId, areaId }: Props) {
  const { colors } = useTheme();
  const initialize = useScheduleStore((state) => state.initialize);
  // friendScheduleは呼び出すたびに新しいオブジェクトを返すため、参照比較の
  // デフォルトだとgetSnapshotが毎回「変化した」と判定され無限ループになる
  // （Issue #242で実際に画面に組み込んだ際に発覚）。GroupJoinScreen/
  // GroupDetailScreenと同じくuseShallowで値の中身を比較するようにする
  const schedule = useScheduleStore(useShallow((state) => state.friendSchedule(friendId, areaId)));

  useEffect(() => {
    initialize(areaId);
  }, [initialize, areaId]);

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
