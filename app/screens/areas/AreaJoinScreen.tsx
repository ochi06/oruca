import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Input } from '../../components/Input';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { joinArea } from '../../lib/areas';

// デモ用に固定の1エリアのみ対応（Issue #65）。エリア検索・複数エリア対応は
// 別タスク（US-018後続）で整備する想定
const DEMO_AREA_ID = 'c06fe2ac-fff3-42a8-b5ea-00756b9396e4';
const DEMO_AREA_NAME = '神戸市産業振興センター';
// カメラが無い/使えない場合のワンタイムコード入力用（大文字小文字を区別しない）
const DEMO_JOIN_CODE = 'KOBE2026';

type Route = 'menu' | 'scan';

function useJoinArea() {
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);

  async function join(areaId: string) {
    setJoining(true);
    try {
      const result = await joinArea(areaId);
      showToast(result === 'joined' ? `${DEMO_AREA_NAME}に参加しました` : 'すでに参加しています');
      return true;
    } catch {
      showToast('エリアへの参加に失敗しました');
      return false;
    } finally {
      setJoining(false);
    }
  }

  return { join, joining };
}

function AreaJoinMenu({ onScanQr }: { onScanQr: () => void }) {
  const { colors } = useTheme();
  const { join, joining } = useJoinArea();
  const [code, setCode] = useState('');

  function handleSubmitCode() {
    if (code.trim().toUpperCase() === DEMO_JOIN_CODE) {
      join(DEMO_AREA_ID).then((ok) => {
        if (ok) setCode('');
      });
      return;
    }
    join(code.trim());
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>エリアに参加する</Text>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSub }]}>QRコードを読み取る</Text>
        <Button label="QRで読み取る" onPress={onScanQr} disabled={joining} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSub }]}>
          またはコードを入力する（例：{DEMO_JOIN_CODE}）
        </Text>
        <Input
          value={code}
          onChangeText={setCode}
          placeholder={DEMO_JOIN_CODE}
          autoCapitalize="characters"
        />
        <View style={styles.buttonRow}>
          <Button
            label={joining ? '参加中…' : '参加する'}
            onPress={handleSubmitCode}
            disabled={joining || code.trim().length === 0}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSub }]}>
          このエリアのQRコード（デモ表示用）
        </Text>
        <View style={styles.qrWrapper}>
          <QRCode value={DEMO_AREA_ID} size={140} />
        </View>
      </View>
    </Screen>
  );
}

function AreaJoinScanner({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const { join, joining } = useJoinArea();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  function handleScan(result: BarcodeScanningResult) {
    if (handled) return;
    setHandled(true);
    join(result.data.trim()).then(onDone);
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
          onBarcodeScanned={handled || joining ? undefined : handleScan}
        />
      </View>
      <Button label="戻る" variant="secondary" onPress={onBack} style={styles.backButton} />
    </Screen>
  );
}

export default function AreaJoinScreen() {
  const [route, setRoute] = useState<Route>('menu');

  if (route === 'scan') {
    return <AreaJoinScanner onBack={() => setRoute('menu')} onDone={() => setRoute('menu')} />;
  }
  return <AreaJoinMenu onScanQr={() => setRoute('scan')} />;
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
  buttonRow: {
    marginTop: spacing.sm,
  },
  qrWrapper: {
    alignItems: 'center',
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
