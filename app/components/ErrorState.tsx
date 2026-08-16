import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Button } from './Button';

type Props = {
  // エラーコードをそのまま出さず、親しみやすい一言メッセージを渡す想定
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  message = 'うまく読み込めませんでした',
  onRetry,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.coral} />
      <Text
        style={[
          styles.message,
          { color: colors.text, fontFamily: typography.body.fontFamily },
        ]}
      >
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <Button label="もう一度試す" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.sm,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
});
