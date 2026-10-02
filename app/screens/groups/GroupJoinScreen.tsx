import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn, fetchUserName, fetchUserNames } from '../../lib/auth';
import { useGroupStore } from '../../store/useGroupStore';
import { resolveUserName } from '../../utils/users';
import { FriendsGroupsStackParamList } from '../../navigation/types';
import { GroupDisplayOverrideModal } from './GroupDisplayOverrideModal';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoin'>;

// 届いた招待（GROUP_MEMBERS.invited_byが自分以外＝誰かからの招待）の
// 一覧から参加/辞退を選ぶ画面（Issue #117）。自分から申請した場合
// （invited_by === null、Issue #119「グループ参加申請」）はここには出さない
export default function GroupJoinScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const groups = useGroupStore((state) => state.groups);
  const [userId, setUserId] = useState<string | null>(null);
  const [defaultName, setDefaultName] = useState('');
  const [authError, setAuthError] = useState(false);
  const invitations = useGroupStore(
    useShallow((state) =>
      state.members.filter(
        (m) => m.user_id === userId && m.status === 'pending' && m.invited_by !== null
      )
    )
  );
  const acceptInvitation = useGroupStore((state) => state.acceptInvitation);
  const declineInvitation = useGroupStore((state) => state.declineInvitation);
  const setMemberDisplay = useGroupStore((state) => state.setMemberDisplay);
  const initialize = useGroupStore((state) => state.initialize);
  const [acceptedMemberId, setAcceptedMemberId] = useState<string | null>(null);
  // Issue #214: 招待者（invited_by）の実際の名前
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  function loadUser() {
    setAuthError(false);
    ensureSignedIn()
      .then((signedInUserId) => {
        setUserId(signedInUserId);
        fetchUserName(signedInUserId).then((name) => setDefaultName(name ?? ''));
      })
      .catch(() => setAuthError(true));
  }

  useEffect(() => {
    initialize();
    loadUser();
  }, [initialize]);

  useEffect(() => {
    const inviterIds = invitations.map((i) => i.invited_by).filter((id): id is string => id !== null);
    if (inviterIds.length === 0) return;
    fetchUserNames(inviterIds)
      .then(setNameMap)
      .catch(() => {
        // 名前解決に失敗しても画面自体は表示する（フォールバック表示になる）
      });
  }, [invitations]);

  async function handleAccept(memberId: string) {
    const result = await acceptInvitation(memberId);
    if (result.status === 'success') {
      showToast('グループに参加しました');
      setAcceptedMemberId(memberId);
    }
  }

  async function handleSaveDisplay(displayName: string | null, localIconUri: string | null) {
    if (!acceptedMemberId || !userId) return;
    await setMemberDisplay(acceptedMemberId, userId, displayName, localIconUri);
    setAcceptedMemberId(null);
  }

  async function handleDecline(memberId: string) {
    const result = await declineInvitation(memberId);
    if (result.status === 'success') {
      showToast('招待を辞退しました');
    }
  }

  if (authError) {
    return (
      <Screen style={styles.container} onBack={() => navigation.goBack()}>
        <ErrorState message="ログイン状態を確認できませんでした。" onRetry={loadUser} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <Text style={[styles.title, { color: colors.text }]}>グループ参加</Text>

      {invitations.length === 0 ? (
        <EmptyState icon="mail-open-outline" message="届いている招待はありません" />
      ) : (
        invitations.map((invitation) => {
          const group = groups.find((g) => g.id === invitation.group_id);
          return (
            <ListItem
              key={invitation.id}
              title={group?.name ?? '不明なグループ'}
              subtitle={`${resolveUserName(nameMap, invitation.invited_by!)}からの招待`}
              trailing={
                <View style={styles.actions}>
                  <Button
                    label="参加する"
                    onPress={() => handleAccept(invitation.id)}
                    style={styles.actionButton}
                  />
                  <Button
                    label="辞退する"
                    variant="secondary"
                    onPress={() => handleDecline(invitation.id)}
                    style={styles.actionButton}
                  />
                </View>
              }
            />
          );
        })
      )}

      <GroupDisplayOverrideModal
        visible={acceptedMemberId !== null}
        defaultName={defaultName}
        onSkip={() => setAcceptedMemberId(null)}
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
});
