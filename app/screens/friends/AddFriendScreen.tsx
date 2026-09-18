import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useFriendAddStore } from '../../store/useFriendAddStore';
import { isOtpExpired } from '../../utils/otp';

type Props = {
  onBack: () => void;
  onScanQr: () => void;
};

// OTP残り秒数（0未満は表示上0にまるめる）
function remainingSeconds(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
}

export default function AddFriendScreen({ onBack, onScanQr }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const myOtp = useFriendAddStore((state) => state.myOtp);
  const refreshMyOtpIfExpired = useFriendAddStore((state) => state.refreshMyOtpIfExpired);
  const verifyCode = useFriendAddStore((state) => state.verifyCode);

  const [now, setNow] = useState(() => new Date());
  const [inputCode, setInputCode] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      refreshMyOtpIfExpired();
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshMyOtpIfExpired]);

  function handleVerify() {
    const result = verifyCode(inputCode.trim());
    switch (result.status) {
      case 'success':
        showToast(`${result.friendName}さんを友達に追加しました`);
        setInputCode('');
        onBack();
        break;
      case 'expired':
        showToast('コードの有効期限が切れています');
        break;
      case 'self':
        showToast('自分のコードは入力できません');
        break;
      case 'not_found':
        showToast('コードが見つかりません');
        break;
    }
  }

  const secondsLeft = isOtpExpired(myOtp, now) ? 0 : remainingSeconds(myOtp.expires_at, now);

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>友達追加</Text>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSub }]}>
          自分のコードを見せる（あと{secondsLeft}秒）
        </Text>
        <View style={styles.qrWrapper}>
          <QRCode value={myOtp.code} size={160} />
        </View>
        <Text style={[styles.code, { color: colors.navy }]}>{myOtp.code}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSub }]}>相手のコードを入力する</Text>
        <Input
          value={inputCode}
          onChangeText={setInputCode}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
        />
        <View style={styles.buttonRow}>
          <Button label="確認" onPress={handleVerify} style={styles.button} />
          <Button
            label="QRで読み取る"
            variant="secondary"
            onPress={onScanQr}
            style={styles.button}
          />
        </View>
      </View>

      <Button label="戻る" variant="secondary" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  qrWrapper: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  code: {
    ...typography.title,
    textAlign: 'center',
    letterSpacing: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  button: {
    flex: 1,
  },
});
