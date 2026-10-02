import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import { triggerTapHaptic } from '../utils/haptics';

type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  // 友達/グループ切替は行全体を均等に埋め、マップ画面のエリア名/グループ名
  // 切替はラベル幅に収まる、という既存2箇所の見た目差をそのまま踏襲する
  fillWidth?: boolean;
  // マップ画面の検索バー内のように小さい表示が必要な場合に使う
  size?: 'md' | 'sm';
};

// 友達/グループ切替（FriendsGroupsListScreen）・エリア名/グループ名切替
// （MapScreen）で共通に使うセグメントコントロール（Issue #324）。
// 両箇所ともPressable直書きでハプティクスが無く、押下スタイルも微妙に
// 異なっていたため、Button/IconButton/Switch（Issue #38・#306）と同じ
// Lightスタイルのハプティクスに統一した
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  fillWidth = true,
  size = 'md',
}: Props<T>) {
  const { colors } = useTheme();
  const textStyle = size === 'md' ? typography.body : typography.caption;
  const buttonStyle = size === 'md' ? styles.buttonMd : styles.buttonSm;

  function handlePress(optionValue: T) {
    triggerTapHaptic();
    onChange(optionValue);
  }

  return (
    <View style={[styles.row, { borderColor: colors.lightblue }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[buttonStyle, fillWidth && styles.fillWidth, selected && { backgroundColor: colors.blue }]}
            onPress={() => handlePress(option.value)}
          >
            <Text style={[textStyle, { color: selected ? '#FFFFFF' : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fillWidth: {
    flex: 1,
  },
  buttonMd: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  buttonSm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
});
