import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn, fetchUserName, isCurrentSessionAnonymous } from '../../lib/auth';
import { useGroupStore } from '../../store/useGroupStore';
import { FriendsGroupsStackParamList } from '../../navigation/types';
import { GroupDisplayOverrideModal } from './GroupDisplayOverrideModal';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoinByCode'>;

// Issue #190: Web簡易体験版向け。GroupQrScanScreenと同じ
// joinOpenGroupByInviteCodeを使うが、カメラQRスキャンの代わりに
// 招待コードを手入力する
export default function GroupJoinByCodeScreen({ navigation }: Props) {
  const onBack = () => navigation.goBack();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const joinOpenGroupByInviteCode = useGroupStore((state) => state.joinOpenGroupByInviteCode);
  const setMemberDisplay = useGroupStore((state) => state.setMemberDisplay);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
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

  async function handleJoin() {
    const trimmed = code.trim();
    if (!trimmed || !userId) {
      showToast('招待コードを入力してください');
      return;
    }

    setJoining(true);
    try {
      const joinResult = await joinOpenGroupByInviteCode(trimmed, userId);
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
          break;
      }
    } catch {
      showToast('参加に失敗しました');
    } finally {
      setJoining(false);
    }
  }

  function handleFinishJoin() {
    setJoinedMemberId(null);
    navigation.popToTop();
  }

  async function handleSaveDisplay(displayName: string | null, localIconUri: string | null) {
    if (!joinedMemberId || !userId) return;
    await setMemberDisplay(joinedMemberId, userId, displayName, localIconUri);
    handleFinishJoin();
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
      <Text style={[styles.title, { color: colors.text }]}>招待コードでグループに参加</Text>
      <Text style={[styles.description, { color: colors.textSub }]}>
        オープングループのQRコードに添えられている招待コードを入力してください。
      </Text>
      <Input
        value={code}
        onChangeText={setCode}
        placeholder="招待コード"
        autoCapitalize="characters"
        editable={!joining}
        autoFocus
      />
      <Button
        label={joining ? '参加中…' : '参加する'}
        onPress={handleJoin}
        disabled={joining || code.trim().length === 0}
        style={styles.joinButton}
      />
      <Button label="戻る" variant="secondary" onPress={onBack} disabled={joining} />

      <GroupDisplayOverrideModal
        visible={joinedMemberId !== null}
        defaultName={defaultName}
        required={isAnonymous}
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
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.caption,
    marginBottom: spacing.lg,
  },
  joinButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
