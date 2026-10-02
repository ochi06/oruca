import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { sendLoginCode, signInAnonymously, verifyLoginCode } from '../lib/auth';
import { isNetworkError } from '../utils/network';

// 会場Wi-Fi等の不安定な回線を想定し、ネットワーク起因のエラーだけは
// 「コードが間違っている」等と区別した案内にする（Issue #314）
const NETWORK_ERROR_MESSAGE = 'ネットワークに接続できません。電波の良い場所でもう一度お試しください';

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
  const [joiningAnonymously, setJoiningAnonymously] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // メール登録なしでオープングループのQR参加のみ行う匿名ログイン（Issue #151）。
  // 成功後はApp.tsx側のonAuthStateChangeがセッションを検知して画面遷移する
  async function handleJoinAnonymously() {
    setJoiningAnonymously(true);
    setErrorMessage(null);
    try {
      await signInAnonymously();
    } catch (error) {
      setErrorMessage(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : '参加処理に失敗しました。時間をおいて再度お試しください');
    } finally {
      setJoiningAnonymously(false);
    }
  }

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
    } catch (error) {
      setErrorMessage(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : '送信に失敗しました。時間をおいて再度お試しください');
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
    } catch (error) {
      setErrorMessage(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : 'コードが正しくないか、有効期限が切れています');
    } finally {
      setVerifying(false);
    }
  }

  if (sentTo) {
    return (
      <Screen style={styles.container} avoidKeyboard>
        <View style={styles.content}>
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
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <View style={styles.content}>
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

        <View style={styles.anonymousJoinLink}>
          <Button
            label={joiningAnonymously ? '参加処理中…' : 'オープングループにQRコードで参加する'}
            variant="secondary"
            onPress={handleJoinAnonymously}
            disabled={joiningAnonymously}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  // Screen.tsxはセーフエリアのinsetsをpaddingLeft/Right等の個別edgeで
  // 適用しており、containerのpadding（全edge一括指定）は同じ画面内で
  // 個別edge指定と競合すると個別edge側が優先される（RN/Yogaの仕様）。
  // 端末によってinsets.left/rightは0になることが多く、その場合
  // containerにpaddingを指定しても左右の余白が実質0になってしまう
  // （Issue #96：タイトル先頭の「o」が画面端で欠ける不具合の原因）。
  // Screen自体は複数画面で共有しているため、ここでは別ノード（content）に
  // 左右余白を持たせることで、insetsの個別edge指定と衝突しないようにする
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
  anonymousJoinLink: {
    marginTop: spacing.lg,
  },
});
