import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { isWantToMeetLimitError, useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';
import { Switch } from './Switch';
import { useToast } from './Toast';

type Props = {
  friendId: string;
};

// 会いたい人の入室通知ON/OFF（US-017）。ONの間、この友達の入室通知は
// 共在していなくても届く（utils/notifications.tsのshouldSendEntryNotification
// で分岐、Issue #270で判定ルールを統合）。ただし相手（friend_id）が
// USERS.allow_entry_notificationsをOFFにしている場合は届かない
export function WantToMeetToggle({ friendId }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const friendship = useNotifyPreferencesStore((state) =>
    state.friendships.find((f) => f.friend_id === friendId)
  );
  const toggleWantToMeet = useNotifyPreferencesStore((state) => state.toggleWantToMeet);

  if (!friendship) {
    return null;
  }

  // 会いたい人は5人まで（Issue #330、DBトリガーで強制）。上限超過時のみ
  // 専用メッセージを出し、それ以外の失敗は汎用メッセージにする
  async function handleToggle() {
    try {
      await toggleWantToMeet(friendId);
    } catch (error) {
      showToast(isWantToMeetLimitError(error) ? '会いたい人は5人まで登録できます' : '操作に失敗しました');
    }
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
        onValueChange={handleToggle}
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
