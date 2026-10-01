import { create } from 'zustand';

import { Group, GroupMember } from '../mocks/groups';
import * as groupsApi from '../lib/groups';
import { checkCanJoin, checkCanLeaveGroup, checkCanTransferOwnership, checkIsGroupOwner } from './groupValidation';
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
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  // RLS上読める（owner／approvedメンバー／is_public=trueの）groups・group_membersを
  // 取得し直す。ミューテーション系のactionは、成功後にこれを呼んで状態を最新化する
  initialize: () => Promise<void>;
  createGroup: (name: string, ownerUserId: string, isPublic: boolean) => Promise<Group>;
  inviteMember: (groupId: string, friendUserId: string, invitedByUserId: string) => Promise<InviteMemberResult>;
  requestToJoinGroup: (groupId: string, userId: string) => Promise<InviteMemberResult>;
  // 招待された本人が辞退する（Issue #117）。自分の行を削除する形でAPI側は実装している
  declineInvitation: (memberId: string) => Promise<GroupActionResult>;
  // 招待された本人が承諾する（Issue #117）
  acceptInvitation: (memberId: string) => Promise<GroupActionResult>;
  approveMember: (groupId: string, memberId: string, requestingUserId: string) => Promise<GroupActionResult>;
  rejectMember: (groupId: string, memberId: string, requestingUserId: string) => Promise<GroupActionResult>;
  removeMember: (groupId: string, memberId: string, requestingUserId: string) => Promise<GroupActionResult>;
  leaveGroup: (groupId: string, userId: string) => Promise<GroupActionResult>;
  transferOwnership: (groupId: string, newOwnerUserId: string, requestingUserId: string) => Promise<GroupActionResult>;
};

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  members: [],
  status: 'idle',
  errorMessage: null,

  initialize: async () => {
    if (get().status === 'loading') return;
    set({ status: 'loading', errorMessage: null });
    try {
      const [groups, members] = await Promise.all([groupsApi.fetchVisibleGroups(), groupsApi.fetchVisibleGroupMembers()]);
      set({ groups, members, status: 'ready' });
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : 'グループ情報の取得に失敗しました' });
    }
  },

  createGroup: async (name, ownerUserId, isPublic) => {
    const newGroup = await groupsApi.createGroup(name, ownerUserId, isPublic);
    await get().initialize();
    return newGroup;
  },

  inviteMember: async (groupId, friendUserId, invitedByUserId) => {
    const { groups, members } = get();
    const blocked = checkCanJoin(groups, members, groupId, friendUserId);
    if (blocked) return blocked;

    await groupsApi.inviteMember(groupId, friendUserId, invitedByUserId);
    await get().initialize();

    // 招待された本人の通知ボックスにgroup_invite通知を追加する（Issue #126）。
    // useNotificationStoreはまだSupabase未接続のモックのため、挿入した行を
    // 更新後のmembersから引き当ててmemberIdを渡す
    const newMember = get().members.find(
      (m) => m.group_id === groupId && m.user_id === friendUserId && m.invited_by === invitedByUserId
    );
    if (newMember) {
      useNotificationStore.getState().addNotification({
        id: `notification-mock-${Date.now()}`,
        user_id: friendUserId,
        type: 'group_invite',
        related_user_id: invitedByUserId,
        area_id: null,
        group_member_id: newMember.id,
        is_read: false,
        created_at: newMember.created_at,
      });
    }

    return { status: 'success' };
  },

  requestToJoinGroup: async (groupId, userId) => {
    const { groups, members } = get();
    const blocked = checkCanJoin(groups, members, groupId, userId);
    if (blocked) return blocked;

    await groupsApi.requestToJoinGroup(groupId, userId);
    await get().initialize();
    return { status: 'success' };
  },

  declineInvitation: async (memberId) => {
    const { members } = get();
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return { status: 'not_found' };
    }

    await groupsApi.declineInvitation(memberId);
    await get().initialize();
    return { status: 'success' };
  },

  acceptInvitation: async (memberId) => {
    const { members } = get();
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      return { status: 'not_found' };
    }

    await groupsApi.acceptInvitation(memberId);
    await get().initialize();
    return { status: 'success' };
  },

  approveMember: async (groupId, memberId, requestingUserId) => {
    const { groups, members } = get();
    const blocked = checkIsGroupOwner(groups, members, groupId, memberId, requestingUserId);
    if (blocked) return blocked;

    await groupsApi.approveMember(memberId);
    await get().initialize();
    return { status: 'success' };
  },

  rejectMember: async (groupId, memberId, requestingUserId) => {
    const { groups, members } = get();
    const blocked = checkIsGroupOwner(groups, members, groupId, memberId, requestingUserId);
    if (blocked) return blocked;

    await groupsApi.rejectMember(memberId);
    await get().initialize();
    return { status: 'success' };
  },

  // 強制退会。承認済みメンバーを一覧から除外する（アカウント自体は残るため
  // 物理削除ではなくレコード削除で表現する。docs/schema.md「設計上の重要な原則」3.参照）
  removeMember: async (groupId, memberId, requestingUserId) => {
    const { groups, members } = get();
    const blocked = checkIsGroupOwner(groups, members, groupId, memberId, requestingUserId);
    if (blocked) return blocked;

    await groupsApi.removeMember(memberId);
    await get().initialize();
    return { status: 'success' };
  },

  leaveGroup: async (groupId, userId) => {
    const { groups, members } = get();
    const check = checkCanLeaveGroup(groups, members, groupId, userId);
    if ('result' in check) return check.result;

    await groupsApi.leaveGroup(check.member.id);
    await get().initialize();
    return { status: 'success' };
  },

  transferOwnership: async (groupId, newOwnerUserId, requestingUserId) => {
    const { groups, members } = get();
    const check = checkCanTransferOwnership(groups, members, groupId, newOwnerUserId, requestingUserId);
    if ('result' in check) return check.result;

    await groupsApi.transferOwnership(groupId, newOwnerUserId);
    await get().initialize();
    return { status: 'success' };
  },
}));
