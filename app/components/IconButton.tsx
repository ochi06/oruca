import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';

type Props = PressableProps & {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  variant?: 'primary' | 'secondary';
  // アイコンのみのボタンはスクリーンリーダーに文字情報が伝わらないため、
  // accessibilityLabelを必須にしている（docs/design-system.md参照）。
  accessibilityLabel: string;
};

export function IconButton({
  name,
  size = 24,
  variant = 'primary',
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={[
        styles.base,
        { backgroundColor: isPrimary ? colors.blue : colors.lightblue },
        style as object,
      ]}
      {...rest}
    >
      <Ionicons
        name={name}
        size={size}
        color={isPrimary ? '#FFFFFF' : colors.navy}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
