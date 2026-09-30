// Issue #144: GROUPS/GROUP_MEMBERSの実Supabaseクエリ。
// lib/areas.tsと同じ方針で、supabaseクライアントを直接叩く薄い関数群にする
// （認可判定＝「誰が何をしてよいか」はRLS側で強制するため、ここでは行わない）。

import { supabase } from './supabase';
import { Group, GroupMember } from '../mocks/groups';
import { generateInviteCode } from '../utils/groupInvite';

// RLS上読める（owner／approvedメンバー／is_public=trueの）グループを全件取得する
export async function fetchVisibleGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('groups').select('*');
  if (error) throw error;
  return (data ?? []) as Group[];
}

// RLS上読める（自分の行／同groupのowner／同groupのapprovedメンバー）GROUP_MEMBERSを全件取得する
export async function fetchVisibleGroupMembers(): Promise<GroupMember[]> {
  const { data, error } = await supabase.from('group_members').select('*');
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

// グループを新規作成し、作成者を管理者(owner_user_id)かつ承認済みメンバーとして
// 登録する（Issue #116）。GROUPS INSERTとGROUP_MEMBERS INSERTは別テーブルへの
// 別クエリのため、2回に分けて呼ぶ（後段が失敗した場合の後始末は今後の検討課題）
export async function createGroup(name: string, ownerUserId: string, isPublic: boolean): Promise<Group> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({ owner_user_id: ownerUserId, name, invite_code: generateInviteCode(), is_public: isPublic })
    .select()
    .single();
  if (groupError) throw groupError;

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: ownerUserId, invited_by: null, status: 'approved' });
  if (memberError) throw memberError;

  return group as Group;
}

// 既存メンバーが友達を招待する（Issue #117）。owner・approvedメンバーのみ
// invited_by付きでinsertできる（RLS: users can request to join or be invited by owner/members）
export async function inviteMember(groupId: string, friendUserId: string, invitedByUserId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: friendUserId, invited_by: invitedByUserId, status: 'pending' });
  if (error) throw error;
}

// 自分から公開グループに参加を申請する（Issue #119）
export async function requestToJoinGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, invited_by: null, status: 'pending' });
  if (error) throw error;
}

// 招待された本人が辞退する（Issue #117）。自分の行を削除する形で表現する
export async function declineInvitation(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

// 招待された本人が承諾する（Issue #117）。RLSは招待された本人が自分の
// pending行(invited_by is not null)をapprovedに更新することを許可している
// （owners can update group_members status ポリシーの例外部分）
export async function acceptInvitation(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').update({ status: 'approved' }).eq('id', memberId);
  if (error) throw error;
}

// 管理者が承認する（Issue #117/#119共通）
export async function approveMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').update({ status: 'approved' }).eq('id', memberId);
  if (error) throw error;
}

// 管理者が拒否する
export async function rejectMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').update({ status: 'rejected' }).eq('id', memberId);
  if (error) throw error;
}

// 管理者による強制退会
export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

// 自分の意思での退会（Issue #134）
export async function leaveGroup(memberId: string): Promise<void> {
  const { error } = await supabase.from('group_members').delete().eq('id', memberId);
  if (error) throw error;
}

// 管理者権限を承認済みの別メンバーに譲る。GROUPS.owner_user_idの付け替え
export async function transferOwnership(groupId: string, newOwnerUserId: string): Promise<void> {
  const { error } = await supabase.from('groups').update({ owner_user_id: newOwnerUserId }).eq('id', groupId);
  if (error) throw error;
}
