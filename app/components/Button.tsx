import React from 'react';
import { GestureResponderEvent, Pressable, Text, StyleSheet, PressableProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { triggerTapHaptic } from '../utils/haptics';

type Props = PressableProps & {
  label: string;
  // destructive: 背景塗りつぶし無し・coral文字・アンダーライン（Issue #357）。
  // アカウント削除・友達削除・グループ退会など、取り消せない破壊的操作向け
  variant?: 'primary' | 'secondary' | 'destructive';
  // タップ時の触覚フィードバック（Issue #38）。既定でON。連続操作で鳴らし
  // たくない画面などでは個別にfalseを渡して無効化できる
  hapticsEnabled?: boolean;
};

// paddingを最小限にした分（Issue #354）、タップ領域が狭くなりすぎないよう
// hitSlopで補う。個別に上書きしたい場合はpropでそのまま渡せる
const DEFAULT_HIT_SLOP = { top: spacing.sm, bottom: spacing.sm, left: spacing.xs, right: spacing.xs };

export function Button({
  label,
  variant = 'primary',
  style,
  onPress,
  hapticsEnabled = true,
  hitSlop = DEFAULT_HIT_SLOP,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isDestructive = variant === 'destructive';

  function handlePress(event: GestureResponderEvent) {
    if (hapticsEnabled) {
      triggerTapHaptic();
    }
    onPress?.(event);
  }

  return (
    <Pressable
      style={[
        styles.base,
        {
          backgroundColor: isDestructive ? 'transparent' : isPrimary ? colors.blue : colors.lightblue,
        },
        style as object,
      ]}
      onPress={handlePress}
      hitSlop={hitSlop}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          isDestructive && styles.destructiveLabel,
          { color: isDestructive ? colors.coral : isPrimary ? '#FFFFFF' : colors.navy },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.heading.fontFamily,
    fontSize: typography.body.fontSize,
  },
  destructiveLabel: {
    textDecorationLine: 'underline',
  },
});
