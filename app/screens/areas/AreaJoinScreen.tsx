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
import { DEFAULT_USER_NAME, ensureSignedIn, fetchUserName, updateUserName } from '../../lib/auth';

// デモ用に固定の1エリアのみ対応（Issue #65）。エリア検索・複数エリア対応は
// 別タスク（US-018後続）で整備する想定
// 2026-09-19: 誤登録された重複エリア(旧c06fe2ac...、半径50m)を削除したため、
// 実際にAreaRegistrationScreen経由で登録された方のIDに差し替えた
const DEMO_AREA_ID = '50a37dc2-7e64-4da6-88a6-4aabfc57d2b1';
const DEMO_AREA_NAME = '神戸産業振興センター';
// カメラが無い/使えない場合のワンタイムコード入力用（大文字小文字を区別しない）
const DEMO_JOIN_CODE = 'KOBE2026';

type Route = 'menu' | 'scan' | 'setName';

type JoinOutcome = {
  ok: boolean;
  // エリア参加自体は成功したが、まだ名前を設定していない（DEFAULT_USER_NAMEのまま）場合true。
  // デモ用に、参加直後に名前入力を促す導線を出し分けるために使う（Issue #65後続）
  needsName: boolean;
};

function useJoinArea() {
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);

  async function join(areaId: string): Promise<JoinOutcome> {
    setJoining(true);
    try {
      const result = await joinArea(areaId);
      showToast(result === 'joined' ? `${DEMO_AREA_NAME}に参加しました` : 'すでに参加しています');

      const userId = await ensureSignedIn();
      const name = await fetchUserName(userId);
      return { ok: true, needsName: name === null || name === DEFAULT_USER_NAME };
    } catch {
      showToast('エリアへの参加に失敗しました');
      return { ok: false, needsName: false };
    } finally {
      setJoining(false);
    }
  }

  return { join, joining };
}

function AreaJoinMenu({
  onScanQr,
  onJoined,
}: {
  onScanQr: () => void;
  onJoined: (needsName: boolean) => void;
}) {
  const { colors } = useTheme();
  const { join, joining } = useJoinArea();
  const [code, setCode] = useState('');

  function handleSubmitCode() {
    const areaId = code.trim().toUpperCase() === DEMO_JOIN_CODE ? DEMO_AREA_ID : code.trim();
    join(areaId).then(({ ok, needsName }) => {
      if (ok) setCode('');
      onJoined(needsName);
    });
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

function AreaJoinScanner({
  onBack,
  onJoined,
}: {
  onBack: () => void;
  onJoined: (needsName: boolean) => void;
}) {
  const { colors } = useTheme();
  const { join, joining } = useJoinArea();
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  function handleScan(result: BarcodeScanningResult) {
    if (handled) return;
    setHandled(true);
    join(result.data.trim()).then(({ needsName }) => onJoined(needsName));
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

// エリア参加直後、まだ名前を設定していない場合に表示する（デモ用、Issue #65後続）。
// 本来のプロフィール編集画面ができるまでの暫定的な導線
function NameSetupScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setSaving(true);
    try {
      const userId = await ensureSignedIn();
      await updateUserName(userId, trimmed);
      showToast('名前を設定しました');
      onDone();
    } catch {
      showToast('名前の設定に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>お名前を設定してください</Text>
      <Text style={[styles.label, { color: colors.textSub }]}>
        在席一覧・マップで他の参加者に表示される名前です
      </Text>
      <Input value={name} onChangeText={setName} placeholder="山田太郎" />
      <View style={styles.buttonRow}>
        <Button
          label={saving ? '保存中…' : '保存する'}
          onPress={handleSave}
          disabled={saving || name.trim().length === 0}
        />
        <Button
          label="あとで設定する"
          variant="secondary"
          onPress={onDone}
          disabled={saving}
          style={styles.skipButton}
        />
      </View>
    </Screen>
  );
}

export default function AreaJoinScreen() {
  const [route, setRoute] = useState<Route>('menu');

  function handleJoined(needsName: boolean) {
    setRoute(needsName ? 'setName' : 'menu');
  }

  if (route === 'scan') {
    return <AreaJoinScanner onBack={() => setRoute('menu')} onJoined={handleJoined} />;
  }
  if (route === 'setName') {
    return <NameSetupScreen onDone={() => setRoute('menu')} />;
  }
  return <AreaJoinMenu onScanQr={() => setRoute('scan')} onJoined={handleJoined} />;
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
  skipButton: {
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
