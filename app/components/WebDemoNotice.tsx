import { Platform, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// Issue #190: ブース展示向けWeb簡易体験版の注意書き。常時タブを開いている
// （バックグラウンドに回さない）ことが検知の条件であることを、どの画面でも
// 見えるように表示する（受け入れ条件：タブを閉じる／他アプリに切り替えると
// 検知が止まることを画面上の案内文で明示する）
export function WebDemoNotice() {
  const { colors } = useTheme();

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <Text style={[styles.notice, { backgroundColor: colors.lightblue, color: colors.text }]}>
      このブラウザ版は簡易体験版です。このタブを開いたままにしてください。タブを閉じる・他のアプリに切り替える・画面をロックすると、在室検知が止まります。
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
