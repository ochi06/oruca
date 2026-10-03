import React from 'react';
import { View, Text, StyleSheet, Pressable, PressableProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = PressableProps & {
  // Issue #278：AreaPresencePopupの在席者一覧のように、名前を表示しない
  // 使い方もあるためoptionalにした
  title?: string;
  subtitle?: string;
  leading?: React.ReactNode; // Avatarなど
  trailing?: React.ReactNode; // 在席ドット・アイコンなど
};

// 友達一覧・エリア一覧などで共通利用する行コンポーネント
export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.row,
        { borderBottomColor: colors.lightblue },
        style as object,
      ]}
      {...rest}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.textContainer}>
        {title ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
            }}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{
              color: colors.textSub,
              fontFamily: typography.caption.fontFamily,
              fontSize: typography.caption.fontSize,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // Issue #393：Issue #345でspacing.xs(4)に詰めすぎ、タップしにくいという
    // developer実機確認を受けてspacing.sm(8)に戻した
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  leading: {
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
});
