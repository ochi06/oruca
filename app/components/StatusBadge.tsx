import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/useTheme';
import { UserStatus, userStatusIcon } from '../constants/status';

type Props = {
  status: UserStatus | null;
  // 省略時は閲覧専用（タップ不可）になる。SettingsScreen（自分）はタップで
  // ステータス選択モーダルを開くために渡し、FriendDetailScreen（友達、
  // 閲覧のみ）は渡さない
  onPress?: () => void;
  disabled?: boolean;
};

// Issue #369：プロフィール画面（自分）・友達詳細画面（友達）で共通利用する、
// アバター右下に重ねるステータスの丸バッジ（Issue #362でSettingsScreenに
// 導入したものを両画面で使えるよう切り出した）。
// Issue #433：実機確認で押しにくいとの指摘のため、badge 24x24→32x32・
// アイコン14px→18pxに拡大し、hitSlopを追加した（WANT_TO_MEET_BADGEのパターン参考）
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export function StatusBadge({ status, onPress, disabled }: Props) {
  const { colors } = useTheme();
  const icon = status ? userStatusIcon(status) : null;

  // 閲覧のみ（onPress無し）でステータスが未設定の場合、タップもできず
  // 示す情報も無いため何も表示しない
  if (!onPress && !icon) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={HIT_SLOP}
      style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.blue }]}
      accessibilityLabel={onPress ? 'ステータスを変更する' : 'ステータス'}
    >
      <Ionicons
        name={icon ?? 'ellipse-outline'}
        size={18}
        color={icon ? colors.blue : colors.textSub}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
