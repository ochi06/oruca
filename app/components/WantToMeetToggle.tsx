import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';
import { Switch } from './Switch';

type Props = {
  friendId: string;
};

// 会いたい人の入室通知ON/OFF（US-017）。ONの間、この友達の入室通知は
// 共在していなくても届く（utils/notifications.tsのshouldSendEntryNotification
// で分岐、Issue #270で判定ルールを統合。Issue #360でUSERS.allow_entry_
// notificationsによる個別許可設定は廃止し、常に許可されている前提にした）
export function WantToMeetToggle({ friendId }: Props) {
  const { colors } = useTheme();
  const friendship = useNotifyPreferencesStore((state) =>
    state.friendships.find((f) => f.friend_id === friendId)
  );
  const toggleWantToMeet = useNotifyPreferencesStore((state) => state.toggleWantToMeet);

  if (!friendship) {
    return null;
  }

  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>会いたい人に登録</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          ONの間、共在していなくてもこの友達の入室通知を受け取ります
        </Text>
      </View>
      <Switch
        value={friendship.want_to_meet}
        onValueChange={() => toggleWantToMeet(friendId)}
        trackColor={{ true: colors.blue, false: colors.lightblue }}
        accessibilityLabel="会いたい人に登録"
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
