import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useNotifyPreferencesStore } from '../store/useNotifyPreferencesStore';
import { Switch } from './Switch';

type Props = {
  friendId: string;
};

// この友達をブロックする（Issue #121・US-008、一方向ブロック）。ONの間、
// 相手からは自分の在席状況（presence_logs）・所属グループ内での在席表示が
// 見えなくなる（各テーブルのSELECTポリシーでDBレベルに強制、supabase/
// migrations参照。Issue #271で適用範囲を拡張）。友達一覧上の名前・アイコン
// など最小限の表示は維持する。
// Issue #367（developer確認済み、2026-10-03）：schedule_note・status_message
// （滞在予定・ひとことメッセージ）はname/icon_urlと同じUSERSの行全体の
// RLSに乗るため、location_hiddenの影響を受けない（ブロックしても見える）。
// 他の通知系トグルと違い「情報を隠す側」が自分の行に設定する値で、友達
// 関係自体は解除されない（コンポーネント名・DBのlocation_hidden列名は
// リネームしていない）
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
