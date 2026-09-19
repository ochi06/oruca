import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { sendLoginLink } from '../lib/auth';

// 簡易的な形式チェックのみ（実際に届くかどうかはSupabase側の送信結果に委ねる）
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// App.tsx側のディープリンク処理でセッションが確立すると、この画面自体が
// アンマウントされて主要タブに切り替わるため、ログイン完了後の遷移は
// ここでは扱わない
export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorMessage('メールアドレスの形式が正しくありません');
      return;
    }

    setSending(true);
    setErrorMessage(null);
    try {
      await sendLoginLink(trimmed);
      setSentTo(trimmed);
    } catch {
      setErrorMessage('送信に失敗しました。時間をおいて再度お試しください');
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <Screen style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>メールを確認してください</Text>
        <Text style={[styles.body, { color: colors.textSub }]}>
          {sentTo} 宛にログイン用のリンクを送信しました。メール内のリンクをタップすると
          ログインが完了します。
        </Text>
        <View style={styles.retryLink}>
          <Button label="別のアドレスで送り直す" variant="secondary" onPress={() => setSentTo(null)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>oruca にログイン</Text>
      <Text style={[styles.body, { color: colors.textSub }]}>
        メールアドレスを入力すると、ログイン用のリンクが届きます（パスワードは不要です）。
      </Text>

      <Input
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        inputMode="email"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!sending}
      />

      {errorMessage ? (
        <Text style={[styles.error, { color: colors.coral }]}>{errorMessage}</Text>
      ) : null}

      <Button
        label={sending ? '送信中…' : 'ログインリンクを送信'}
        onPress={handleSend}
        disabled={sending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.sm,
  },
  error: {
    fontSize: typography.caption.fontSize,
    marginBottom: spacing.sm,
  },
  retryLink: {
    marginTop: spacing.lg,
  },
});
