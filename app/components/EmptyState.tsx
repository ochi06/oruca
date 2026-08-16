import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  message: string;
};

export function EmptyState({ icon = 'sad-outline', message }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.textSub} />
      <Text
        style={[
          styles.message,
          { color: colors.textSub, fontFamily: typography.body.fontFamily },
        ]}
      >
        {message}
      </Text>
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
