import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useShallow } from 'zustand/react/shallow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { ListItem } from '../../components/ListItem';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn, fetchUserNames } from '../../lib/auth';
import { GroupMember } from '../../mocks/groups';
import { useGroupStore } from '../../store/useGroupStore';
import { isGroupAdmin } from '../../utils/groupAuth';
import { canSeeOpenGroupPresence } from '../../utils/groupOpenType';
import { resolveGroupMemberDisplay, resolveUserName } from '../../utils/users';
import { formatDate } from '../../utils/format';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { fetchPresentUserIds } from '../../lib/groups';
import { FriendsGroupsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const onBack = () => navigation.goBack();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const group = useGroupStore((state) => state.groups.find((g) => g.id === groupId));
  const members = useGroupStore(
    useShallow((state) => state.members.filter((m) => m.group_id === groupId)),
  );
  const inviteMember = useGroupStore((state) => state.inviteMember);
  const approveMember = useGroupStore((state) => state.approveMember);
  const rejectMember = useGroupStore((state) => state.rejectMember);
  const removeMember = useGroupStore((state) => state.removeMember);
  const leaveGroup = useGroupStore((state) => state.leaveGroup);
  const transferOwnership = useGroupStore((state) => state.transferOwnership);
  const initialize = useGroupStore((state) => state.initialize);
  const friends = useFriendUsers();
  const [transferTarget, setTransferTarget] = useState<GroupMember | null>(null);
  const [menuTargetMember, setMenuTargetMember] = useState<GroupMember | null>(null);
  // Issue #413: 退会・強制退会は取り消せない操作のため、他の破壊的操作
  // （友達削除・アカウント削除・エリア削除）と同じ「確認Modal→説明文→実行」
  // の二段階にする
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Issue #343: 承認待ち・メンバーの各セクションを折りたたみ可能にする。
  // 承認待ちは見落とし防止のため初期表示は開く、メンバーは人数が多くなり
  // がちなため初期表示は閉じておく（developer確認済み）
  const [pendingOpen, setPendingOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  // オープングループの在席ユーザーID集合（Issue #148の可視性ルール用）。
  // RLS（presence in monitored areas is readable）上、自分がそのエリアを
  // 監視(USER_AREAS)していなければ自分以外の行は返らないため、
  // 「自分がそのエリアに在席中か」もこの集合に自分のIDが含まれるかで判定できる
  const [presentUserIds, setPresentUserIds] = useState<Set<string> | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  // Issue #214: メンバー一覧・招待者表示に使う実際の名前。member.user_id・
  // member.invited_byをまとめて1回のクエリで解決する
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  function loadUser() {
    setAuthError(false);
    ensureSignedIn()
      .then(setUserId)
      .catch(() => setAuthError(true));
  }

  useEffect(() => {
    initialize();
    loadUser();
  }, [initialize]);

  useEffect(() => {
    const idsToResolve = members.flatMap((m) => [m.user_id, ...(m.invited_by ? [m.invited_by] : [])]);
    if (idsToResolve.length === 0) return;
    fetchUserNames(idsToResolve)
      .then(setNameMap)
      .catch(() => {
        // 名前解決に失敗しても画面自体は表示する（フォールバック表示になる）
      });
  }, [members]);

  useEffect(() => {
    if (group?.type !== 'open' || !group.area_id) {
      setPresentUserIds(null);
      return;
    }
    fetchPresentUserIds(group.area_id)
      .then(setPresentUserIds)
      .catch(() => setPresentUserIds(new Set()));
  }, [group?.type, group?.area_id]);

  if (authError) {
    return (
      <Screen style={styles.container} onBack={onBack}>
        <ErrorState message="ログイン状態を確認できませんでした。" onRetry={loadUser} />
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen style={styles.container} onBack={onBack}>
        <EmptyState icon="people-outline" message="グループが見つかりません" />
      </Screen>
    );
  }

  const isAdmin = userId !== null && isGroupAdmin(group, userId);
  const pendingMembers = members.filter((m) => m.status === 'pending');
  const approvedMembers = members.filter((m) => m.status === 'approved');
  const selfIsPresentInGroupArea = userId !== null && (presentUserIds?.has(userId) ?? false);
  const showPresence = canSeeOpenGroupPresence(group, selfIsPresentInGroupArea);
  // rejected済みの友達は再招待できるので除外しない（inviteMember側の判定と合わせる）
  const invitableFriends = friends.filter(
    (friend) => !members.some((m) => m.user_id === friend.id && m.status !== 'rejected')
  );

  async function handleInvite(friendId: string) {
    if (!userId) return;
    const result = await inviteMember(groupId, friendId, userId);
    if (result.status === 'already_member') {
      showToast('既に招待済み、またはメンバーです');
      return;
    }
    if (result.status === 'success') {
      showToast('招待しました');
      setIsInviting(false);
    }
  }

  async function handleApprove(memberId: string) {
    if (!userId) return;
    const result = await approveMember(groupId, memberId, userId);
    if (result.status === 'forbidden') {
      showToast('管理者のみ承認できます');
      return;
    }
    if (result.status === 'success') {
      showToast('参加を承認しました');
    }
  }

  async function handleReject(memberId: string) {
    if (!userId) return;
    const result = await rejectMember(groupId, memberId, userId);
    if (result.status === 'forbidden') {
      showToast('管理者のみ拒否できます');
      return;
    }
    if (result.status === 'success') {
      showToast('参加を拒否しました');
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget || !userId) return;
    setRemoving(true);
    try {
      const result = await removeMember(groupId, removeTarget.id, userId);
      if (result.status === 'forbidden') {
        showToast('管理者のみ退会させることができます');
        return;
      }
      if (result.status === 'success') {
        showToast('メンバーを退会させました');
      }
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  async function handleConfirmLeave() {
    if (!userId) return;
    setLeaving(true);
    try {
      const result = await leaveGroup(groupId, userId);
      if (result.status === 'last_admin') {
        showToast('管理者権限を誰かに譲ってから退会してください');
        setLeaving(false);
        setLeaveConfirmVisible(false);
        return;
      }
      if (result.status === 'success') {
        showToast('グループを退会しました');
        onBack();
      }
    } catch {
      setLeaving(false);
    }
  }

  async function handleConfirmTransfer() {
    if (!transferTarget || !userId) return;
    const target = transferTarget;
    const result = await transferOwnership(groupId, target.user_id, userId);
    setTransferTarget(null);
    if (result.status === 'success') {
      showToast(`${resolveUserName(nameMap, target.user_id)}さんに管理者権限を譲りました`);
    } else {
      showToast('管理者権限の譲渡に失敗しました');
    }
  }

  return (
    <Screen style={styles.container} onBack={onBack}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: colors.text }]}>{group.name}</Text>

      <View style={styles.groupMetaRow}>
        <Text style={[typography.caption, { color: colors.textSub }]}>
          {group.type === 'open' ? 'オープングループ' : 'クローズドグループ'}
        </Text>
        {group.type === 'open' && group.expires_at && (
          <Text style={[typography.caption, { color: colors.textSub }]}>
            {formatDate(new Date(group.expires_at))}まで公開
          </Text>
        )}
      </View>

      {group.type === 'open' && isAdmin && (
        <View style={styles.qrSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>参加用QRコード</Text>
          <QRCode value={group.invite_code} size={160} />
          <Text style={{ color: colors.textSub, marginTop: spacing.sm }}>{group.invite_code}</Text>
        </View>
      )}

      <Button label="友達を招待する" onPress={() => setIsInviting(true)} style={styles.inviteButton} />

      {group.type !== 'open' && isAdmin && (
        <View style={styles.section}>
          <Pressable
            style={styles.sectionHeader}
            onPress={() => setPendingOpen((open) => !open)}
            accessibilityLabel={pendingOpen ? '承認待ちを閉じる' : '承認待ちを開く'}
          >
            <Text style={[typography.body, { color: colors.text }]}>
              承認待ち{pendingMembers.length > 0 ? `（${pendingMembers.length}）` : ''}
            </Text>
            <Ionicons
              name={pendingOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={20}
              color={colors.textSub}
            />
          </Pressable>
          {pendingOpen &&
            (pendingMembers.length === 0 ? (
              <EmptyState icon="hourglass-outline" message="承認待ちの申請はありません" />
            ) : (
              pendingMembers.map((member) => {
                const display = resolveGroupMemberDisplay(member, {
                  name: resolveUserName(nameMap, member.user_id),
                  iconUrl: null,
                });
                return (
                  <ListItem
                    key={member.id}
                    title={display.name}
                    subtitle={member.invited_by ? `${resolveUserName(nameMap, member.invited_by)}からの招待` : '招待コードで参加申請'}
                    leading={<Avatar name={display.name} iconUrl={display.iconUrl} />}
                    trailing={
                      <View style={styles.actions}>
                        <IconButton
                          name="checkmark"
                          variant="ghost"
                          color={colors.green}
                          size={16}
                          accessibilityLabel={`${display.name}の参加を承認`}
                          onPress={() => handleApprove(member.id)}
                        />
                        <IconButton
                          name="close"
                          variant="ghost"
                          color={colors.coral}
                          size={16}
                          accessibilityLabel={`${display.name}の参加を拒否`}
                          onPress={() => handleReject(member.id)}
                        />
                      </View>
                    }
                  />
                );
              })
            ))}
        </View>
      )}

      <View style={styles.section}>
        <Pressable
          style={styles.sectionHeader}
          onPress={() => setMembersOpen((open) => !open)}
          accessibilityLabel={membersOpen ? 'メンバーを閉じる' : 'メンバーを開く'}
        >
          <Text style={[typography.body, { color: colors.text }]}>
            メンバー{approvedMembers.length > 0 ? `（${approvedMembers.length}）` : ''}
          </Text>
          <Ionicons
            name={membersOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={20}
            color={colors.textSub}
          />
        </Pressable>
        {membersOpen &&
          (approvedMembers.length === 0 ? (
            <EmptyState icon="people-outline" message="メンバーがいません" />
          ) : (
            approvedMembers.map((member) => {
              const display = resolveGroupMemberDisplay(member, {
                name: resolveUserName(nameMap, member.user_id),
                iconUrl: null,
              });
              return (
                <ListItem
                  key={member.id}
                  title={display.name}
                  subtitle={
                    showPresence
                      ? presentUserIds?.has(member.user_id)
                        ? '在席中'
                        : '不在'
                      : undefined
                  }
                  leading={<Avatar name={display.name} iconUrl={display.iconUrl} />}
                  trailing={
                    member.user_id === group.owner_user_id ? (
                      <View style={[styles.adminBadge, { backgroundColor: colors.lightblue }]}>
                        <Text style={[styles.adminBadgeText, { color: colors.navy }]}>管理者</Text>
                      </View>
                    ) : isAdmin ? (
                      <IconButton
                        name="ellipsis-vertical"
                        variant="ghost"
                        size={16}
                        accessibilityLabel={`${display.name}のメニュー`}
                        onPress={() => setMenuTargetMember(member)}
                      />
                    ) : undefined
                  }
                />
              );
            })
          ))}
      </View>

      <Button
        label="グループを退会する"
        variant="secondary"
        onPress={() => setLeaveConfirmVisible(true)}
        style={styles.leaveButton}
      />
      </ScrollView>

      <Modal
        visible={menuTargetMember !== null}
        onClose={() => setMenuTargetMember(null)}
        title={menuTargetMember ? resolveUserName(nameMap, menuTargetMember.user_id) : undefined}
      >
        <Button
          label="権限を譲る"
          variant="secondary"
          onPress={() => {
            setTransferTarget(menuTargetMember);
            setMenuTargetMember(null);
          }}
          style={styles.menuButton}
        />
        <Button
          label="退会させる"
          variant="destructive"
          style={styles.menuButton}
          onPress={() => {
            setRemoveTarget(menuTargetMember);
            setMenuTargetMember(null);
          }}
        />
      </Modal>

      <Modal
        visible={removeTarget !== null}
        onClose={() => (removing ? undefined : setRemoveTarget(null))}
        title="メンバーを退会させますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          {removeTarget ? resolveUserName(nameMap, removeTarget.user_id) : ''}
          さんをグループから退会させます。この操作は取り消せません。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setRemoveTarget(null)}
            disabled={removing}
            style={styles.modalButton}
          />
          <Button
            label={removing ? '退会させています…' : '退会させる'}
            variant="destructive"
            onPress={handleConfirmRemove}
            disabled={removing}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      <Modal
        visible={leaveConfirmVisible}
        onClose={() => (leaving ? undefined : setLeaveConfirmVisible(false))}
        title="グループを退会しますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          このグループを退会します。この操作は取り消せません。再度参加するには
          招待または招待コードが必要です。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setLeaveConfirmVisible(false)}
            disabled={leaving}
            style={styles.modalButton}
          />
          <Button
            label={leaving ? '退会中…' : '退会する'}
            variant="destructive"
            onPress={handleConfirmLeave}
            disabled={leaving}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      <Modal
        visible={transferTarget !== null}
        onClose={() => setTransferTarget(null)}
        title="管理者権限を譲りますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          {transferTarget ? resolveUserName(nameMap, transferTarget.user_id) : ''}さんに管理者権限を譲ります。
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

      <Modal visible={isInviting} onClose={() => setIsInviting(false)} title="友達を招待する">
        {invitableFriends.length === 0 ? (
          <EmptyState icon="person-add-outline" message="招待できる友達がいません" />
        ) : (
          invitableFriends.map((friend) => (
            <ListItem
              key={friend.id}
              title={friend.name}
              leading={<Avatar name={friend.name} iconUrl={friend.icon_url} />}
              trailing={
                <Button label="招待する" onPress={() => handleInvite(friend.id)} style={styles.actionButton} />
              }
            />
          ))
        )}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  groupMetaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  adminBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  adminBadgeText: {
    ...typography.caption,
  },
  menuButton: {
    marginBottom: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
  inviteButton: {
    marginBottom: spacing.lg,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
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
