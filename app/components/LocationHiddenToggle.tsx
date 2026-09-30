import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';

type Props = {
  friendId: string;
};

// この友達に自分の位置情報を見せない（Issue #121、一方向ブロック）。
// ONの間、相手からは自分のpresence_logsが見えなくなる（presence_logsの
// SELECTポリシーでDBレベルに強制、supabase/migrations参照）。他の通知系
// トグルと違い「情報を隠す側」が自分の行に設定する値で、友達関係自体は
// 解除されない
export function LocationHiddenToggle({ friendId }: Props) {
  const { colors } = useTheme();
  const friendship = useNotifyPreferencesStore((state) =>
    state.friendships.find((f) => f.friend_id === friendId)
  );
  const toggleLocationHidden = useNotifyPreferencesStore((state) => state.toggleLocationHidden);

  if (!friendship) {
    return null;
  }

  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>自分の位置情報を見せない</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          ONの間、この友達はあなたの在席状況を確認できなくなります（友達関係は解除されません）
        </Text>
      </View>
      <Switch
        value={friendship.location_hidden}
        onValueChange={() => toggleLocationHidden(friendId)}
        trackColor={{ true: colors.coral, false: colors.lightblue }}
        accessibilityLabel="自分の位置情報を見せない"
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
