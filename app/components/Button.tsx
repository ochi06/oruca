import React from 'react';
import { Pressable, Text, StyleSheet, PressableProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = PressableProps & {
  label: string;
  variant?: 'primary' | 'secondary';
};

export function Button({ label, variant = 'primary', style, ...rest }: Props) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={[
        styles.base,
        {
          backgroundColor: isPrimary ? colors.blue : colors.lightblue,
        },
        style as object,
      ]}
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  label: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
