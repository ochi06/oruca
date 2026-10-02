import React from 'react';
import { GestureResponderEvent, Pressable, Text, StyleSheet, PressableProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { triggerTapHaptic } from '../utils/haptics';

type Props = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
  // タップ時の触覚フィードバック（Issue #38）。既定でON。連続操作で鳴らし
  // たくない画面などでは個別にfalseを渡して無効化できる
  hapticsEnabled?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  style,
  onPress,
  hapticsEnabled = true,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';

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
          backgroundColor: isPrimary ? colors.blue : colors.lightblue,
        },
        style as object,
      ]}
      onPress={handlePress}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          { color: isPrimary ? '#FFFFFF' : colors.navy },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.heading.fontFamily,
    fontSize: typography.body.fontSize,
  },
});
