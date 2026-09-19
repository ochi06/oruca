import { create } from 'zustand';

import { Group, GroupMember, mockGroupMembers, mockGroups } from '../mocks/groups';
import { isGroupAdmin } from '../utils/groupAuth';

export type GroupActionResult = { status: 'success' } | { status: 'forbidden' } | { status: 'not_found' };

type GroupState = {
  groups: Group[];
  members: GroupMember[];
  approveMember: (groupId: string, memberId: string, requestingUserId: string) => GroupActionResult;
  rejectMember: (groupId: string, memberId: string, requestingUserId: string) => GroupActionResult;
  removeMember: (groupId: string, memberId: string, requestingUserId: string) => GroupActionResult;
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
}));
