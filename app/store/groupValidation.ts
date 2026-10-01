// useGroupStore.tsのミューテーション系actionが、Supabaseへの実クエリを投げる前に
// 行う事前チェックをまとめた純粋関数群（Issue #144）。最終的な認可の強制はRLS側が
// 担うが、ここでの事前チェックはRLSに弾かれる前にUIへ分かりやすい理由
// （forbidden/not_found/already_memberなど）を返すためのもの
import { Group, GroupMember } from '../mocks/groups';
import { GroupActionResult, InviteMemberResult } from './useGroupStore';

export function findGroupAndMember(
  groups: Group[],
  members: GroupMember[],
  groupId: string,
  memberId: string
): { group?: Group; member?: GroupMember } {
  const group = groups.find((g) => g.id === groupId);
  const member = members.find((m) => m.id === memberId && m.group_id === groupId);
  return { group, member };
}

// 招待(inviteMember)・自己申請(requestToJoinGroup)共通の事前チェック。
// 対象グループが存在し、かつ対象ユーザーがまだ（rejected以外で）メンバーでないことを確認する
export function checkCanJoin(
  groups: Group[],
  members: GroupMember[],
  groupId: string,
  targetUserId: string
): InviteMemberResult | null {
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    return { status: 'not_found' };
  }
  const alreadyMember = members.some(
    (m) => m.group_id === groupId && m.user_id === targetUserId && m.status !== 'rejected'
  );
  if (alreadyMember) {
    return { status: 'already_member' };
  }
  return null;
}

// approveMember/rejectMember/removeMember共通の事前チェック。
// 対象グループ・メンバーが存在し、requestingUserIdがそのグループのowner_user_idであることを確認する
export function checkIsGroupOwner(
  groups: Group[],
  members: GroupMember[],
  groupId: string,
  memberId: string,
  requestingUserId: string
): GroupActionResult | null {
  const { group, member } = findGroupAndMember(groups, members, groupId, memberId);
  if (!group || !member) {
    return { status: 'not_found' };
  }
  if (group.owner_user_id !== requestingUserId) {
    return { status: 'forbidden' };
  }
  return null;
}

// leaveGroupの事前チェック。対象のGROUP_MEMBERS行を特定した上で、
// 自分が最後の管理者（owner_user_id）でないことを確認する
export function checkCanLeaveGroup(
  groups: Group[],
  members: GroupMember[],
  groupId: string,
  userId: string
): { result: GroupActionResult } | { member: GroupMember } {
  const group = groups.find((g) => g.id === groupId);
  const member = members.find((m) => m.group_id === groupId && m.user_id === userId);
  if (!group || !member) {
    return { result: { status: 'not_found' } };
  }
  if (group.owner_user_id === userId) {
    return { result: { status: 'last_admin' } };
  }
  return { member };
}

// transferOwnershipの事前チェック。requestingUserIdが管理者であること、
// 譲渡先(newOwnerUserId)がそのグループの承認済みメンバーであることを確認する
export function checkCanTransferOwnership(
  groups: Group[],
  members: GroupMember[],
  groupId: string,
  newOwnerUserId: string,
  requestingUserId: string
): { result: GroupActionResult } | { ok: true } {
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    return { result: { status: 'not_found' } };
  }
  if (group.owner_user_id !== requestingUserId) {
    return { result: { status: 'forbidden' } };
  }
  const newOwnerMember = members.find(
    (m) => m.group_id === groupId && m.user_id === newOwnerUserId && m.status === 'approved'
  );
  if (!newOwnerMember) {
    return { result: { status: 'not_found' } };
  }
  return { ok: true };
}
