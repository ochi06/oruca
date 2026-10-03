import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = {
  scheduleNote: string | null;
  statusMessage: string | null;
};

// 友達1人分の滞在予定・ひとことメッセージ表示（US-011）。Issue #367で
// エリア単位の概念を廃止し、USERSのschedule_note/status_messageを
// そのまま表示するだけのシンプルな表示に変更した。どちらも未設定なら
// 何も表示しない。画面上の配置（どのセクションに置くか）はIssue #369で対応する
export function FriendScheduleNote({ scheduleNote, statusMessage }: Props) {
  const { colors } = useTheme();

  if (!scheduleNote && !statusMessage) {
    return null;
  }

  return (
    <View style={styles.container}>
      {statusMessage ? <Text style={{ color: colors.text }}>{statusMessage}</Text> : null}
      {scheduleNote ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>滞在予定</Text>
          <Text style={{ color: colors.text }}>{scheduleNote}</Text>
        </>
      ) : null}
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
