import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Input } from '../../components/Input';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn, fetchUserName, isCurrentSessionAnonymous } from '../../lib/auth';
import { useFriendAddStore } from '../../store/useFriendAddStore';
import { useGroupStore } from '../../store/useGroupStore';
import { FriendsGroupsStackParamList } from '../../navigation/types';
import { GroupDisplayOverrideModal } from '../groups/GroupDisplayOverrideModal';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'RedeemCode'>;

type RedeemResult =
  | { source: 'group'; status: 'success'; groupName: string; memberId: string }
  | { source: 'group'; status: 'already_member' }
  | { source: 'friend'; status: 'success'; friendName: string }
  | { source: 'friend'; status: 'expired' }
  | { source: 'friend'; status: 'self' }
  // 匿名セッションからの友達追加は拒否される（Issue #200）
  | { source: 'friend'; status: 'forbidden' }
  | { status: 'not_found' }
  | { status: 'error' };

// Issue #208: 「相手から渡されたコードを読み取る/入力する」操作を1画面に統合する。
// グループの招待コード（英数字6桁）・友達追加のOTP（数字6桁）は文字種が完全に
// 排他ではないため、フォーマットでの事前判別はせず、まずグループ招待コードとして
// 検索し、見つからなければ友達OTPとして検証する順でバックエンド判別する。
// カメラQRスキャンはWeb非対応のため、Platform.OSで出し分ける
// （既存のMapStackNavigator.web.tsx等と同じ方針）
export default function RedeemCodeScreen({ navigation }: Props) {
  const onBack = () => navigation.goBack();
  // 成功時は、この画面に至るまでの中間画面（AddFriend等）もまとめて抜けて一覧に戻る
  const onDone = () => navigation.popToTop();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const joinOpenGroupByInviteCode = useGroupStore((state) => state.joinOpenGroupByInviteCode);
  const setMemberDisplay = useGroupStore((state) => state.setMemberDisplay);
  const verifyFriendCode = useFriendAddStore((state) => state.verifyCode);
  // expo-cameraはWeb版の実装も持つため、呼び出し自体はPlatformを問わず安全。
  // カメラUIの表示だけをPlatform.OS !== 'web'で出し分ける
  const [permission, requestPermission] = useCameraPermissions();
  const handledRef = useRef(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joinedMemberId, setJoinedMemberId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultName, setDefaultName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ensureSignedIn(), isCurrentSessionAnonymous()]).then(([signedInUserId, anonymous]) => {
      if (cancelled) return;
      setUserId(signedInUserId);
      setIsAnonymous(anonymous);
      fetchUserName(signedInUserId).then((name) => {
        if (!cancelled) setDefaultName(name ?? '');
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function redeemCode(trimmedCode: string, signedInUserId: string): Promise<RedeemResult> {
    try {
      const groupResult = await joinOpenGroupByInviteCode(trimmedCode, signedInUserId);
      if (groupResult.status === 'success') {
        return { source: 'group', status: 'success', groupName: groupResult.groupName, memberId: groupResult.memberId };
      }
      if (groupResult.status === 'already_member') {
        return { source: 'group', status: 'already_member' };
      }
      // not_found → グループの招待コードではなかったので、友達OTPとして試す
    } catch {
      return { status: 'error' };
    }

    const friendResult = await verifyFriendCode(trimmedCode);
    if (friendResult.status === 'success') {
      return { source: 'friend', status: 'success', friendName: friendResult.friendName };
    }
    if (friendResult.status === 'expired' || friendResult.status === 'self' || friendResult.status === 'forbidden') {
      return { source: 'friend', status: friendResult.status };
    }
    if (friendResult.status === 'error') {
      return { status: 'error' };
    }
    return { status: 'not_found' };
  }

  // viaScanがtrueの場合、終了的な失敗（成功しなかった）時に前の画面へ戻る
  // （カメラスキャンはやり直しがしにくいため）。手入力の場合は画面に留まり
  // コードを打ち直せるようにする（既存のAddFriendScreen/GroupJoinByCodeScreenの
  // 挙動を踏襲）
  async function processCode(rawCode: string, viaScan: boolean) {
    const trimmed = rawCode.trim();
    if (!trimmed || !userId) {
      if (!viaScan) showToast('コードを入力してください');
      return;
    }

    setSubmitting(true);
    const result = await redeemCode(trimmed, userId);
    setSubmitting(false);

    if ('source' in result && result.source === 'group') {
      if (result.status === 'success') {
        showToast(`「${result.groupName}」に参加しました`);
        setJoinedMemberId(result.memberId);
        return;
      }
      // already_member
      showToast('既に参加済みのグループです');
      onBack();
      return;
    }

    if ('source' in result && result.source === 'friend') {
      if (result.status === 'success') {
        showToast(`${result.friendName}さんを友達に追加しました`);
        onDone();
        return;
      }
      if (result.status === 'expired') {
        showToast('コードの有効期限が切れています');
        if (viaScan) onBack();
        return;
      }
      if (result.status === 'forbidden') {
        showToast('匿名アカウントでは友達追加はできません');
        if (viaScan) onBack();
        return;
      }
      // self
      showToast(viaScan ? '自分のコードは読み取れません' : '自分のコードは入力できません');
      if (viaScan) onBack();
      return;
    }

    if (result.status === 'error') {
      showToast('通信に失敗しました。もう一度お試しください');
      if (viaScan) onBack();
      return;
    }

    // not_found（グループ招待コード・友達OTPのどちらとしても見つからなかった）
    showToast('コードが見つかりません');
    if (viaScan) onBack();
  }

  async function handleScan(result: BarcodeScanningResult) {
    if (handledRef.current || !userId) return;
    handledRef.current = true;
    await processCode(result.data, true);
  }

  function handleFinishGroupJoin() {
    setJoinedMemberId(null);
    onDone();
  }

  async function handleSaveGroupDisplay(displayName: string | null, localIconUri: string | null) {
    if (!joinedMemberId || !userId) return;
    await setMemberDisplay(joinedMemberId, userId, displayName, localIconUri);
    handleFinishGroupJoin();
  }

  if (!userId) {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>コードを読み取る・入力する</Text>
      <Text style={[styles.description, { color: colors.textSub }]}>
        グループの招待コード・友達追加のコードのどちらでも読み取れます。
      </Text>

      {Platform.OS !== 'web' && (
        <>
          {!permission ? (
            <LoadingIndicator />
          ) : !permission.granted ? (
            <ErrorState
              message="QRコードを読み取るにはカメラの利用を許可してください。"
              onRetry={requestPermission}
            />
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handledRef.current ? undefined : handleScan}
              />
            </View>
          )}
        </>
      )}

      <Text style={[styles.label, { color: colors.textSub }]}>コードを入力する</Text>
      <Input
        value={code}
        onChangeText={setCode}
        placeholder="コード"
        autoCapitalize="characters"
        maxLength={6}
        editable={!submitting}
      />
      <Button
        label={submitting ? '確認中…' : '確認する'}
        onPress={() => processCode(code, false)}
        disabled={submitting || code.trim().length === 0}
        style={styles.submitButton}
      />
      <Button label="戻る" variant="secondary" onPress={onBack} disabled={submitting} />

      <GroupDisplayOverrideModal
        visible={joinedMemberId !== null}
        defaultName={defaultName}
        required={isAnonymous}
        onSkip={handleFinishGroupJoin}
        onSave={handleSaveGroupDisplay}
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
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  cameraWrapper: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  camera: {
    flex: 1,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
