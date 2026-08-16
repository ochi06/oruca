import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// 仮実装：将来的にはシャチが泳ぐ・海藻が揺れる・ヒトデが動くような
// oruca 独自のアニメーションに差し替える想定（docs/design-system.md参照）。
// 素材ができるまでは標準のActivityIndicatorで機能させる。
type Props = {
  message?: string;
};

export function LoadingIndicator({ message }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.blue} />
      {message ? (
        <Text
          style={[
            styles.message,
            { color: colors.textSub, fontFamily: typography.body.fontFamily },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  message: {
    marginTop: spacing.sm,
    fontSize: typography.caption.fontSize,
  },
});
