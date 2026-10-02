import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';

type Props = {
  friendId: string;
};

// この友達をブロックする（Issue #121・US-008、一方向ブロック）。ONの間、
// 相手からは自分の在席状況（presence_logs）・滞在予定（area_schedules/
// area_schedule_overrides）・所属グループ内での在席表示がすべて見えなく
// なる（各テーブルのSELECTポリシーでDBレベルに強制、supabase/migrations
// 参照。Issue #271で適用範囲を拡張）。友達一覧上の名前・アイコンなど
// 最小限の表示は維持する。他の通知系トグルと違い「情報を隠す側」が自分の
// 行に設定する値で、友達関係自体は解除されない（コンポーネント名・DBの
// location_hidden列名はリネームしていない）
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
        <Text style={[styles.title, { color: colors.text }]}>この友達をブロックする</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          ONの間、この友達にはあなたの在席状況・滞在予定・グループ内の在席が見えなくなります（友達関係は解除されません）
        </Text>
      </View>
      <Switch
        value={friendship.location_hidden}
        onValueChange={() => toggleLocationHidden(friendId)}
        trackColor={{ true: colors.coral, false: colors.lightblue }}
        accessibilityLabel="この友達をブロックする"
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
