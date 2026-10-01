import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useFriendAddStore } from '../../store/useFriendAddStore';
import { isOtpExpired } from '../../utils/otp';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// OTP残り秒数（0未満は表示上0にまるめる）
function remainingSeconds(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
}

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'AddFriend'>;

// Issue #208: 「相手のコードを読み取る/入力する」側はRedeemCodeScreenに統合した。
// この画面は「自分のコードを提示する」側のみを引き続き担当する
export default function AddFriendScreen({ navigation }: Props) {
  const onBack = () => navigation.goBack();
  const onRedeemCode = () => navigation.navigate('RedeemCode');
  const { colors } = useTheme();
  const myOtp = useFriendAddStore((state) => state.myOtp);
  const refreshMyOtpIfExpired = useFriendAddStore((state) => state.refreshMyOtpIfExpired);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    refreshMyOtpIfExpired();
    const timer = setInterval(() => {
      setNow(new Date());
      refreshMyOtpIfExpired();
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshMyOtpIfExpired]);

  const secondsLeft = myOtp === null || isOtpExpired(myOtp, now) ? 0 : remainingSeconds(myOtp.expires_at, now);

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>友達追加</Text>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSub }]}>
          自分のコードを見せる（あと{secondsLeft}秒）
        </Text>
        {myOtp === null ? (
          <LoadingIndicator />
        ) : (
          <>
            <View style={styles.qrWrapper}>
              <QRCode value={myOtp.code} size={160} />
            </View>
            <Text style={[styles.code, { color: colors.navy }]}>{myOtp.code}</Text>
          </>
        )}
      </View>

      <Button label="相手のコードを読み取る・入力する" onPress={onRedeemCode} />
      <Button label="戻る" variant="secondary" onPress={onBack} style={styles.backButton} />
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
  backButton: {
    marginTop: spacing.sm,
  },
});
