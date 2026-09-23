import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';

type Props = {
  friendId: string;
};

// 共在時のみの入室通知ON/OFF（US-016）。ONの間、この友達の入室通知は自分が
// 同じエリアに在席している時だけ届く（utils/notifications.tsの
// shouldSendEntryNotificationで分岐）。友達詳細画面（Issue #114で
// react-navigation本導入後に配置予定）から埋め込んで使う想定の単体コンポーネント。
// ナビゲーション構成が固まるまでは、まだどの画面からも呼び出されていない
export function CopresenceNotificationToggle({ friendId }: Props) {
  const { colors } = useTheme();
  const friendship = useNotifyPreferencesStore((state) =>
    state.friendships.find((f) => f.friend_id === friendId)
  );
  const toggleNotifyOnlyWhenCopresent = useNotifyPreferencesStore(
    (state) => state.toggleNotifyOnlyWhenCopresent
  );

  if (!friendship) {
    return null;
  }

  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>共在時のみ通知</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          ONの間、自分がこのエリアにいる時だけ入室通知を受け取ります
        </Text>
      </View>
      <Switch
        value={friendship.notify_only_when_copresent}
        onValueChange={() => toggleNotifyOnlyWhenCopresent(friendId)}
        trackColor={{ true: colors.blue, false: colors.lightblue }}
        accessibilityLabel="共在時のみ通知"
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
