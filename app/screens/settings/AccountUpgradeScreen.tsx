import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { sendUpgradeEmailCode, verifyUpgradeEmailCode } from '../../lib/auth';
import { SettingsStackParamList } from '../../navigation/types';

// 簡易的な形式チェックのみ（実際に届くかどうかはSupabase側の送信結果に委ねる）
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;

type Props = NativeStackScreenProps<SettingsStackParamList, 'AccountUpgrade'>;

// 匿名セッションに本登録用のメールアドレスを紐づける画面（Issue #168）。
// sendLoginCode/verifyLoginCode（LoginScreen）と同じ6桁コードのUI/UXだが、
// ログインではなく現在のセッション（auth.uid）はそのままに本登録へ切り替える
export default function AccountUpgradeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorMessage('メールアドレスの形式が正しくありません');
      return;
    }

    setSending(true);
    setErrorMessage(null);
    try {
      await sendUpgradeEmailCode(trimmed);
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
      await verifyUpgradeEmailCode(sentTo, code.trim());
      setDone(true);
    } catch {
      setErrorMessage('コードが正しくないか、有効期限が切れています');
    } finally {
      setVerifying(false);
    }
  }

  if (done) {
    return (
      <Screen style={styles.container} avoidKeyboard>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>登録が完了しました</Text>
          <Text style={[styles.body, { color: colors.textSub }]}>
            {sentTo} をアカウントのメールアドレスとして登録しました。
          </Text>
          <Button label="設定にもどる" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  if (sentTo) {
    return (
      <Screen style={styles.container} avoidKeyboard>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>コードを入力してください</Text>
          <Text style={[styles.body, { color: colors.textSub }]}>
            {sentTo} 宛に{CODE_LENGTH}桁の確認コードを送信しました。
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
            label={verifying ? '登録中…' : '登録する'}
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
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>アカウントを登録する</Text>
        <Text style={[styles.body, { color: colors.textSub }]}>
          メールアドレスを登録すると、機種変更後も同じアカウントでログインできるようになります（パスワードは不要です）。
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
          label={sending ? '送信中…' : '確認コードを送信'}
          onPress={handleSendCode}
          disabled={sending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
