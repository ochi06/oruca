import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useFriendAddStore } from '../../store/useFriendAddStore';

type Props = {
  onBack: () => void;
  onDone: () => void;
};

export default function QrScanScreen({ onBack, onDone }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const verifyCode = useFriendAddStore((state) => state.verifyCode);
  const [permission, requestPermission] = useCameraPermissions();
  // 1回のスキャンで複数回verifyCodeが呼ばれる（連続フレームで同じQRを検出する）のを防ぐ
  const handledRef = useRef(false);

  function handleScan(result: BarcodeScanningResult) {
    if (handledRef.current) return;
    handledRef.current = true;

    const verifyResult = verifyCode(result.data.trim());
    switch (verifyResult.status) {
      case 'success':
        showToast(`${verifyResult.friendName}さんを友達に追加しました`);
        onDone();
        break;
      case 'expired':
        showToast('コードの有効期限が切れています');
        onBack();
        break;
      case 'self':
        showToast('自分のコードは読み取れません');
        onBack();
        break;
      case 'not_found':
        showToast('コードが見つかりません');
        onBack();
        break;
    }
  }

  if (!permission) {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen style={styles.container}>
        <ErrorState
          message="QRコードを読み取るにはカメラの利用を許可してください。"
          onRetry={requestPermission}
        />
        <Button label="戻る" variant="secondary" onPress={onBack} style={styles.backButton} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>QRコードを読み取る</Text>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handledRef.current ? undefined : handleScan}
        />
      </View>
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
    marginBottom: spacing.md,
  },
  cameraWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  camera: {
    flex: 1,
  },
  backButton: {
    marginTop: spacing.sm,
  },
});
