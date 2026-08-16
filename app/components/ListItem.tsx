import React from 'react';
import { View, Text, StyleSheet, Pressable, PressableProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = PressableProps & {
  title: string;
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
        <Text
          style={{
            color: colors.text,
            fontFamily: typography.body.fontFamily,
            fontSize: typography.body.fontSize,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
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
