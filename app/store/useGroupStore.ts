import { create } from 'zustand';

import { Group, GroupMember, mockGroupMembers, mockGroups } from '../mocks/groups';
import { isGroupAdmin } from '../utils/groupAuth';

export type GroupActionResult =
  | { status: 'success' }
  | { status: 'forbidden' }
  | { status: 'not_found' }
  // 自分が最後の管理者（owner_user_id）のため退会できない（Issue #11）
  | { status: 'last_admin' };

type GroupState = {
  groups: Group[];
  members: GroupMember[];
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
