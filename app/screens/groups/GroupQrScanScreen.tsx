import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CURRENT_USER_ID } from '../../mocks/presence';
import { useGroupStore } from '../../store/useGroupStore';
import { findUserName } from '../../utils/users';
import { FriendsGroupsStackParamList } from '../../navigation/types';
import { GroupDisplayOverrideModal } from './GroupDisplayOverrideModal';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupQrScan'>;

// オープングループのinvite_codeをQRで読み込んで即時参加する画面（Issue #148）。
// 友達追加のQrScanScreenと同じ構造（1回のスキャンで複数回発火するのを防ぐガード等）
export default function GroupQrScanScreen({ navigation }: Props) {
  const onBack = () => navigation.goBack();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const joinOpenGroupByInviteCode = useGroupStore((state) => state.joinOpenGroupByInviteCode);
  const setMemberDisplay = useGroupStore((state) => state.setMemberDisplay);
  const [permission, requestPermission] = useCameraPermissions();
  const handledRef = useRef(false);
  const [joinedMemberId, setJoinedMemberId] = useState<string | null>(null);

  async function handleScan(result: BarcodeScanningResult) {
    if (handledRef.current) return;
    handledRef.current = true;

    const joinResult = await joinOpenGroupByInviteCode(result.data.trim(), CURRENT_USER_ID);
    switch (joinResult.status) {
      case 'success':
        showToast(`「${joinResult.groupName}」に参加しました`);
        setJoinedMemberId(joinResult.memberId);
        break;
      case 'already_member':
        showToast('既に参加済みのグループです');
        onBack();
        break;
      case 'not_found':
        showToast('コードが見つかりません');
        onBack();
        break;
    }
  }

  function handleFinishJoin() {
    setJoinedMemberId(null);
    navigation.popToTop();
  }

  async function handleSaveDisplay(displayName: string | null, localIconUri: string | null) {
    if (!joinedMemberId) return;
    await setMemberDisplay(joinedMemberId, CURRENT_USER_ID, displayName, localIconUri);
    handleFinishJoin();
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
      <Text style={[styles.title, { color: colors.text }]}>グループQRコードを読み取る</Text>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handledRef.current ? undefined : handleScan}
        />
      </View>
      <Button label="戻る" variant="secondary" onPress={onBack} style={styles.backButton} />

      <GroupDisplayOverrideModal
        visible={joinedMemberId !== null}
        defaultName={findUserName(CURRENT_USER_ID)}
        onSkip={handleFinishJoin}
        onSave={handleSaveDisplay}
      />
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
