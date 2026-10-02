import React from 'react';
import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function Input({ style, ...rest }: TextInputProps) {
  const { colors } = useTheme();

  return (
    <TextInput
      placeholderTextColor={colors.textSub}
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.lightblue,
          color: colors.text,
        },
        style as object,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
  },
});
