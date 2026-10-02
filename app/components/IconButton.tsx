import React from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { triggerTapHaptic } from '../utils/haptics';

type Props = PressableProps & {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  // ghost: 背景なし（Issue #318）。一覧行・ヘッダーの⋮メニューなど、
  // 常時表示されるボタンとして強調したくない箇所向け
  variant?: 'primary' | 'secondary' | 'ghost';
  // アイコン色をvariantの既定色（primaryは白、secondary/ghostはnavy）から
  // 上書きする（Issue #341、グループ詳細画面の承認/拒否アイコンを緑/赤に）
  color?: string;
  // アイコンのみのボタンはスクリーンリーダーに文字情報が伝わらないため、
  // accessibilityLabelを必須にしている（docs/design-system.md参照）。
  accessibilityLabel: string;
  // タップ時の触覚フィードバック（Issue #38）。既定でON
  hapticsEnabled?: boolean;
};

export function IconButton({
  name,
  size = 24,
  variant = 'primary',
  color,
  style,
  onPress,
  hapticsEnabled = true,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

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
        { backgroundColor: isPrimary ? colors.blue : isGhost ? 'transparent' : colors.lightblue },
        style as object,
      ]}
      onPress={handlePress}
      {...rest}
    >
      <Ionicons
        name={name}
        size={size}
        color={color ?? (isPrimary ? '#FFFFFF' : colors.navy)}
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
