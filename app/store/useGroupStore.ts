import { create } from 'zustand';

import { Group, GroupMember, mockGroupMembers, mockGroups } from '../mocks/groups';
import { isGroupAdmin } from '../utils/groupAuth';
import { generateInviteCode } from '../utils/groupInvite';
import { useNotificationStore } from './useNotificationStore';

export type GroupActionResult =
  | { status: 'success' }
  | { status: 'forbidden' }
  | { status: 'not_found' }
  // 自分が最後の管理者（owner_user_id）のため退会できない（Issue #11）
  | { status: 'last_admin' };

// inviteMember（他薦）・requestToJoinGroup（自薦）の両方で使う結果型。
// 「既にpending/approvedな行が存在する」を弾く判定は共通（rejected済みならやり直せる）
export type InviteMemberResult =
  | { status: 'success' }
  | { status: 'not_found' }
  | { status: 'already_member' };

type GroupState = {
  groups: Group[];
  members: GroupMember[];
  // グループを新規作成し、作成者を管理者(owner_user_id)かつ承認済みメンバーとして
  // 登録する（Issue #116）。グループ名の検証（空・文字数上限）は呼び出し側（画面）で行う
  createGroup: (name: string, ownerUserId: string, isPublic: boolean) => Group;
  // 既存メンバーが友達を招待する（Issue #117）。承認は不要（管理者権限チェックなし）。
  // status: 'pending'のGROUP_MEMBERS行を作り、invited_byに招待者を記録する
  inviteMember: (groupId: string, friendUserId: string, invitedByUserId: string) => InviteMemberResult;
  // 自分から公開グループに参加を申請する（Issue #119）。invited_byはnull
  // （招待されたのではなく自分の意思で申請したことを表す）。管理者の承認待ち
  requestToJoinGroup: (groupId: string, userId: string) => InviteMemberResult;
  // 招待された本人が承諾する（Issue #117）。requestingUserIdが行の持ち主と
  // 一致する場合のみ許可する（他人の招待を勝手に承諾させないため）
  acceptInvitation: (memberId: string, requestingUserId: string) => GroupActionResult;
  // 招待された本人が辞退する（Issue #117）。rejectMember（管理者による拒否）とは
  // 呼び出し元が異なるだけで、内部的にはstatusを'rejected'にする点は同じ
  declineInvitation: (memberId: string, requestingUserId: string) => GroupActionResult;
  approveMember: (groupId: string, memberId: string, requestingUserId: string) => GroupActionResult;
  rejectMember: (groupId: string, memberId: string, requestingUserId: string) => GroupActionResult;
  removeMember: (groupId: string, memberId: string, requestingUserId: string) => GroupActionResult;
  // 自分の意思での退会（Issue #11）。強制退会（removeMember）と違い、
  // 管理者権限は不要だが、自分が最後の管理者の場合は退会できない
  leaveGroup: (groupId: string, userId: string) => GroupActionResult;
  // 管理者権限を、承認済みの別メンバーに譲る（Issue #11）。
  // GROUPS.owner_user_idは唯一の管理者を表すため（docs/schema.md参照）、
  // 譲渡＝owner_user_idの付け替えとして実装する（複数管理者化はしない）
  transferOwnership: (groupId: string, newOwnerUserId: string, requestingUserId: string) => GroupActionResult;
};

function findGroupAndMember(groups: Group[], members: GroupMember[], groupId: string, memberId: string) {
  const group = groups.find((g) => g.id === groupId);
  const member = members.find((m) => m.id === memberId && m.group_id === groupId);
  return { group, member };
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: mockGroups,
  members: mockGroupMembers,

  createGroup: (name, ownerUserId, isPublic) => {
    const { groups, members } = get();
    const nowIso = new Date().toISOString();

    const newGroup: Group = {
      id: `group-mock-${groups.length + 1}`,
      owner_user_id: ownerUserId,
      name,
      invite_code: generateInviteCode(),
      is_public: isPublic,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const ownerMember: GroupMember = {
      id: `member-mock-${members.length + 1}`,
      group_id: newGroup.id,
      user_id: ownerUserId,
      invited_by: null,
      status: 'approved',
      created_at: nowIso,
      updated_at: nowIso,
    };

    set({
      groups: [...groups, newGroup],
      members: [...members, ownerMember],
    });
    return newGroup;
  },

  inviteMember: (groupId, friendUserId, invitedByUserId) => {
    const { groups, members } = get();
    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      return { status: 'not_found' };
    }
    const alreadyMember = members.some(
      (m) => m.group_id === groupId && m.user_id === friendUserId && m.status !== 'rejected'
    );
    if (alreadyMember) {
      return { status: 'already_member' };
    }

    const nowIso = new Date().toISOString();
    const newMember: GroupMember = {
      id: `member-mock-${members.length + 1}`,
      group_id: groupId,
      user_id: friendUserId,
      invited_by: invitedByUserId,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    };
    set({ members: [...members, newMember] });

    // 招待された本人の通知ボックスにgroup_invite通知を追加する（Issue #126）
    useNotificationStore.getState().addNotification({
      id: `notification-mock-${Date.now()}`,
      user_id: friendUserId,
      type: 'group_invite',
      related_user_id: invitedByUserId,
      area_id: null,
      group_member_id: newMember.id,
      is_read: false,
      created_at: nowIso,
    });

    return { status: 'success' };
  },

  requestToJoinGroup: (groupId, userId) => {
    const { groups, members } = get();
    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      return { status: 'not_found' };
    }
    const alreadyMember = members.some(
      (m) => m.group_id === groupId && m.user_id === userId && m.status !== 'rejected'
    );
    if (alreadyMember) {
      return { status: 'already_member' };
    }

    const nowIso = new Date().toISOString();
    const newMember: GroupMember = {
      id: `member-mock-${members.length + 1}`,
      group_id: groupId,
      user_id: userId,
      invited_by: null,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
    };
    set({ members: [...members, newMember] });
    return { status: 'success' };
  },

  acceptInvitation: (memberId, requestingUserId) => {
    const { members } = get();
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return { status: 'not_found' };
    }
    if (member.user_id !== requestingUserId) {
      return { status: 'forbidden' };
    }

    set({
      members: members.map((m) => (m.id === memberId ? { ...m, status: 'approved' } : m)),
    });
    return { status: 'success' };
  },

  declineInvitation: (memberId, requestingUserId) => {
    const { members } = get();
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return { status: 'not_found' };
    }
    if (member.user_id !== requestingUserId) {
      return { status: 'forbidden' };
    }

    set({
      members: members.map((m) => (m.id === memberId ? { ...m, status: 'rejected' } : m)),
    });
    return { status: 'success' };
  },

  approveMember: (groupId, memberId, requestingUserId) => {
    const { groups, members } = get();
    const { group, member } = findGroupAndMember(groups, members, groupId, memberId);
    if (!group || !member) {
      return { status: 'not_found' };
    }
    if (!isGroupAdmin(group, requestingUserId)) {
      return { status: 'forbidden' };
    }

    set({
      members: members.map((m) => (m.id === memberId ? { ...m, status: 'approved' } : m)),
    });
    return { status: 'success' };
  },

  rejectMember: (groupId, memberId, requestingUserId) => {
    const { groups, members } = get();
    const { group, member } = findGroupAndMember(groups, members, groupId, memberId);
    if (!group || !member) {
      return { status: 'not_found' };
    }
    if (!isGroupAdmin(group, requestingUserId)) {
      return { status: 'forbidden' };
    }

    set({
      members: members.map((m) => (m.id === memberId ? { ...m, status: 'rejected' } : m)),
    });
    return { status: 'success' };
  },

  // 強制退会。承認済みメンバーを一覧から除外する（アカウント自体は残るため
  // 物理削除ではなくレコード削除で表現する。docs/schema.md「設計上の重要な原則」3.参照）
  removeMember: (groupId, memberId, requestingUserId) => {
    const { groups, members } = get();
    const { group, member } = findGroupAndMember(groups, members, groupId, memberId);
    if (!group || !member) {
      return { status: 'not_found' };
    }
    if (!isGroupAdmin(group, requestingUserId)) {
      return { status: 'forbidden' };
    }

    set({
      members: members.filter((m) => m.id !== memberId),
    });
    return { status: 'success' };
  },

  leaveGroup: (groupId, userId) => {
    const { groups, members } = get();
    const group = groups.find((g) => g.id === groupId);
    const member = members.find((m) => m.group_id === groupId && m.user_id === userId);
    if (!group || !member) {
      return { status: 'not_found' };
    }
    if (group.owner_user_id === userId) {
      return { status: 'last_admin' };
    }

    set({
      members: members.filter((m) => m.id !== member.id),
    });
    return { status: 'success' };
  },

  transferOwnership: (groupId, newOwnerUserId, requestingUserId) => {
    const { groups, members } = get();
    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      return { status: 'not_found' };
    }
    if (!isGroupAdmin(group, requestingUserId)) {
      return { status: 'forbidden' };
    }
    // 譲渡先は、このグループの承認済みメンバーである必要がある
    const newOwnerMember = members.find(
      (m) => m.group_id === groupId && m.user_id === newOwnerUserId && m.status === 'approved'
    );
    if (!newOwnerMember) {
      return { status: 'not_found' };
    }

    set({
      groups: groups.map((g) => (g.id === groupId ? { ...g, owner_user_id: newOwnerUserId } : g)),
    });
    return { status: 'success' };
  },
}));
