import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
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

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoin'>;

// 届いた招待（GROUP_MEMBERS.invited_byが自分以外＝誰かからの招待）の
// 一覧から参加/辞退を選ぶ画面（Issue #117）。自分から申請した場合
// （invited_by === null、Issue #119「グループ参加申請」）はここには出さない
export default function GroupJoinScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const groups = useGroupStore((state) => state.groups);
  const invitations = useGroupStore(
    useShallow((state) =>
      state.members.filter(
        (m) => m.user_id === CURRENT_USER_ID && m.status === 'pending' && m.invited_by !== null
      )
    )
  );
  const acceptInvitation = useGroupStore((state) => state.acceptInvitation);
  const declineInvitation = useGroupStore((state) => state.declineInvitation);
  const setMemberDisplay = useGroupStore((state) => state.setMemberDisplay);
  const initialize = useGroupStore((state) => state.initialize);
  const [acceptedMemberId, setAcceptedMemberId] = useState<string | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  async function handleAccept(memberId: string) {
    const result = await acceptInvitation(memberId);
    if (result.status === 'success') {
      showToast('グループに参加しました');
      setAcceptedMemberId(memberId);
    }
  }

  async function handleSaveDisplay(displayName: string | null, localIconUri: string | null) {
    if (!acceptedMemberId) return;
    await setMemberDisplay(acceptedMemberId, CURRENT_USER_ID, displayName, localIconUri);
    setAcceptedMemberId(null);
  }

  async function handleDecline(memberId: string) {
    const result = await declineInvitation(memberId);
    if (result.status === 'success') {
      showToast('招待を辞退しました');
    }
  }

  return (
    <Screen style={styles.container}>
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
              subtitle={`${findUserName(invitation.invited_by!)}からの招待`}
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

      <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton} />

      <GroupDisplayOverrideModal
        visible={acceptedMemberId !== null}
        defaultName={findUserName(CURRENT_USER_ID)}
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
  backButton: {
    marginTop: spacing.md,
  },
});
