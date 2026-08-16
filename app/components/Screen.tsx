import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

type Props = ViewProps & {
  // 入力欄がある画面（OTP入力・検索など）ではtrueにして、キーボードが
  // 入力欄を隠さないようにする（docs/design-system.md参照）
  avoidKeyboard?: boolean;
};

// 各画面のルートで使う共通レイアウト。ノッチ・ホームバー等を避けるセーフエリア
// 対応を画面ごとに個別実装せず、ここに集約する（docs/design-system.md参照）。
export function Screen({ children, style, avoidKeyboard = false, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style as object,
      ]}
      {...rest}
    >
      {children}
    </View>
  );

  if (!avoidKeyboard) {
    return content;
  }

  return (
    <KeyboardAvoidingView
      style={styles.base}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
