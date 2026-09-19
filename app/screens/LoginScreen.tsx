import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { sendLoginCode, verifyLoginCode } from '../lib/auth';

// 簡易的な形式チェックのみ（実際に届くかどうかはSupabase側の送信結果に委ねる）
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;

// ログイン完了時（verifyLoginCodeが成功しセッションが確立した時）は、
// App.tsx側のonAuthStateChangeがセッションを検知してこの画面自体を
// アンマウントするため、遷移処理はここでは扱わない
export default function LoginScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorMessage('メールアドレスの形式が正しくありません');
      return;
    }

    setSending(true);
    setErrorMessage(null);
    try {
      await sendLoginCode(trimmed);
      setSentTo(trimmed);
    } catch {
      setErrorMessage('送信に失敗しました。時間をおいて再度お試しください');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyCode() {
    if (!sentTo) return;
    if (code.trim().length !== CODE_LENGTH) {
      setErrorMessage(`${CODE_LENGTH}桁のコードを入力してください`);
      return;
    }

    setVerifying(true);
    setErrorMessage(null);
    try {
      await verifyLoginCode(sentTo, code.trim());
      // 成功時はApp.tsx側のonAuthStateChangeがセッションを検知して画面遷移する
    } catch {
      setErrorMessage('コードが正しくないか、有効期限が切れています');
    } finally {
      setVerifying(false);
    }
  }

  if (sentTo) {
    return (
      <Screen style={styles.container} avoidKeyboard>
        <Text style={[styles.title, { color: colors.text }]}>コードを入力してください</Text>
        <Text style={[styles.body, { color: colors.textSub }]}>
          {sentTo} 宛に{CODE_LENGTH}桁のログインコードを送信しました。
        </Text>

        <Input
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          editable={!verifying}
        />

        {errorMessage ? (
          <Text style={[styles.error, { color: colors.coral }]}>{errorMessage}</Text>
        ) : null}

        <Button
          label={verifying ? 'ログイン中…' : 'ログイン'}
          onPress={handleVerifyCode}
          disabled={verifying}
        />

        <View style={styles.retryLink}>
          <Button
            label="別のアドレスで送り直す"
            variant="secondary"
            onPress={() => {
              setSentTo(null);
              setCode('');
              setErrorMessage(null);
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>oruca にログイン</Text>
      <Text style={[styles.body, { color: colors.textSub }]}>
        メールアドレスを入力すると、ログイン用のコードが届きます（パスワードは不要です）。
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
        label={sending ? '送信中…' : 'ログインコードを送信'}
        onPress={handleSendCode}
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
