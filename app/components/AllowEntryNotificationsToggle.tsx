import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  value: boolean;
  onValueChange: () => void;
};

// 「会いたい人」への入室通知を許可するかどうかのワンタップ切替（US-017）。
// アカウント全体で1つの設定（USERS.allow_entry_notifications）で、友達ごとの
// notify_enabled（US-007）とは別物。OFFの間は、自分を「会いたい人」に
// 登録している相手にも、入室通知が届かなくなる
// （utils/notifications.tsのshouldSendWantToMeetNotificationで分岐）。
// 値の取得・更新はSettingsScreen側（他のグローバル設定と同じ構成）で行い、
// このコンポーネントは表示専用（Issue #243）
export function AllowEntryNotificationsToggle({ value, onValueChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>会いたい人への入室通知</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          OFFの間、自分を会いたい人に登録している相手には入室通知が届きません
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.blue, false: colors.lightblue }}
        accessibilityLabel="会いたい人への入室通知"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    ...typography.body,
  },
  subtitle: {
    ...typography.caption,
  },
});
