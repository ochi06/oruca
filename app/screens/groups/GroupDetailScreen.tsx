import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CURRENT_USER_ID, mockUsers } from '../../mocks/presence';
import { GroupMember } from '../../mocks/groups';
import { useGroupStore } from '../../store/useGroupStore';
import { isGroupAdmin } from '../../utils/groupAuth';

type Props = {
  groupId: string;
  onBack: () => void;
};

function findUserName(userId: string): string {
  return mockUsers.find((user) => user.id === userId)?.name ?? '不明なユーザー';
}

export default function GroupDetailScreen({ groupId, onBack }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const group = useGroupStore((state) => state.groups.find((g) => g.id === groupId));
  const members = useGroupStore(
    useShallow((state) => state.members.filter((m) => m.group_id === groupId)),
  );
  const approveMember = useGroupStore((state) => state.approveMember);
  const rejectMember = useGroupStore((state) => state.rejectMember);
  const removeMember = useGroupStore((state) => state.removeMember);
  const leaveGroup = useGroupStore((state) => state.leaveGroup);
  const transferOwnership = useGroupStore((state) => state.transferOwnership);
  const [transferTarget, setTransferTarget] = useState<GroupMember | null>(null);

  if (!group) {
    return (
      <Screen style={styles.container}>
        <EmptyState icon="people-outline" message="グループが見つかりません" />
        <Button label="戻る" variant="secondary" onPress={onBack} />
      </Screen>
    );
  }

  const isAdmin = isGroupAdmin(group, CURRENT_USER_ID);
  const pendingMembers = members.filter((m) => m.status === 'pending');
  const approvedMembers = members.filter((m) => m.status === 'approved');

  function handleApprove(memberId: string) {
    const result = approveMember(groupId, memberId, CURRENT_USER_ID);
    if (result.status === 'forbidden') {
      showToast('管理者のみ承認できます');
      return;
    }
    if (result.status === 'success') {
      showToast('参加を承認しました');
    }
  }

  function handleReject(memberId: string) {
    const result = rejectMember(groupId, memberId, CURRENT_USER_ID);
    if (result.status === 'forbidden') {
      showToast('管理者のみ拒否できます');
      return;
    }
    if (result.status === 'success') {
      showToast('参加を拒否しました');
    }
  }

  function handleRemove(memberId: string) {
    const result = removeMember(groupId, memberId, CURRENT_USER_ID);
    if (result.status === 'forbidden') {
      showToast('管理者のみ退会させることができます');
      return;
    }
    if (result.status === 'success') {
      showToast('メンバーを退会させました');
    }
  }

  function handleLeave() {
    const result = leaveGroup(groupId, CURRENT_USER_ID);
    if (result.status === 'last_admin') {
      showToast('管理者権限を誰かに譲ってから退会してください');
      return;
    }
    if (result.status === 'success') {
      showToast('グループを退会しました');
      onBack();
    }
  }

  function handleConfirmTransfer() {
    if (!transferTarget) return;
    const result = transferOwnership(groupId, transferTarget.user_id, CURRENT_USER_ID);
    setTransferTarget(null);
    if (result.status === 'success') {
      showToast(`${findUserName(transferTarget.user_id)}さんに管理者権限を譲りました`);
    } else {
      showToast('管理者権限の譲渡に失敗しました');
    }
  }

  return (
    <Screen style={styles.container}>
      <Button label="戻る" variant="secondary" onPress={onBack} style={styles.backButton} />
      <Text style={[styles.title, { color: colors.text }]}>{group.name}</Text>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>承認待ち</Text>
          {pendingMembers.length === 0 ? (
            <EmptyState icon="hourglass-outline" message="承認待ちの申請はありません" />
          ) : (
            pendingMembers.map((member) => (
              <ListItem
                key={member.id}
                title={findUserName(member.user_id)}
                subtitle={member.invited_by ? `${findUserName(member.invited_by)}からの招待` : '招待コードで参加申請'}
                leading={<Avatar name={findUserName(member.user_id)} iconUrl={null} />}
                trailing={
                  <View style={styles.actions}>
                    <Button label="承認" onPress={() => handleApprove(member.id)} style={styles.actionButton} />
                    <Button
                      label="拒否"
                      variant="secondary"
                      onPress={() => handleReject(member.id)}
                      style={styles.actionButton}
                    />
                  </View>
                }
              />
            ))
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>メンバー</Text>
        {approvedMembers.length === 0 ? (
          <EmptyState icon="people-outline" message="メンバーがいません" />
        ) : (
          approvedMembers.map((member) => (
            <ListItem
              key={member.id}
              title={findUserName(member.user_id)}
              leading={<Avatar name={findUserName(member.user_id)} iconUrl={null} />}
              trailing={
                isAdmin && member.user_id !== group.owner_user_id ? (
                  <View style={styles.actions}>
                    <Button
                      label="権限を譲る"
                      variant="secondary"
                      onPress={() => setTransferTarget(member)}
                      style={styles.actionButton}
                    />
                    <Button
                      label="退会させる"
                      variant="secondary"
                      onPress={() => handleRemove(member.id)}
                      style={styles.actionButton}
                    />
                  </View>
                ) : undefined
              }
            />
          ))
        )}
      </View>

      <Button
        label="グループを退会する"
        variant="secondary"
        onPress={handleLeave}
        style={styles.leaveButton}
      />

      <Modal
        visible={transferTarget !== null}
        onClose={() => setTransferTarget(null)}
        title="管理者権限を譲りますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          {transferTarget ? findUserName(transferTarget.user_id) : ''}さんに管理者権限を譲ります。
          あなたはこのグループの管理者ではなくなります。この操作は取り消せません。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setTransferTarget(null)}
            style={styles.modalButton}
          />
          <Button label="譲る" onPress={handleConfirmTransfer} style={styles.modalButton} />
        </View>
      </Modal>
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  leaveButton: {
    marginTop: spacing.md,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
