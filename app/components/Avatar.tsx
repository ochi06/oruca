import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { typography } from '../theme/typography';

type Props = {
  iconUrl?: string | null;
  name: string;
  size?: number;
};

// USERS.icon_url が無い場合は、名前の頭文字を丸背景に表示するプレースホルダー
export function Avatar({ iconUrl, name, size = 40 }: Props) {
  const { colors } = useTheme();
  const initial = name.trim().charAt(0) || '?';

  if (iconUrl) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.lightblue,
        },
      ]}
    >
      <Text
        style={{
          color: colors.navy,
          fontFamily: typography.heading.fontFamily,
          fontSize: size * 0.4,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#ccc',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
