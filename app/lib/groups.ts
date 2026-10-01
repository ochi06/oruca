// Issue #144: GROUPS/GROUP_MEMBERSの実Supabaseクエリ。
// lib/areas.tsと同じ方針で、supabaseクライアントを直接叩く薄い関数群にする
// （認可判定＝「誰が何をしてよいか」はRLS側で強制するため、ここでは行わない）。

import { supabase } from './supabase';
import { uploadIconToAvatarsBucket } from './avatars';
import { Group, GroupMember, GroupType } from '../mocks/groups';
import { generateInviteCode } from '../utils/groupInvite';
import { computeOpenGroupExpiresAt } from '../utils/groupOpenType';

// RLS上読める（owner／approvedメンバーの）グループを全件取得する
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
// 登録する（Issue #116、Issue #148でtype/area_idを追加）。GROUPS INSERTと
// GROUP_MEMBERS INSERTは別テーブルへの別クエリのため、2回に分けて呼ぶ
// （後段が失敗した場合の後始末は今後の検討課題）。
// type='open'の場合、expires_at（created_at+7日）はクライアント側で計算して
// セットする（DB側のdefaultには持たせず、常に明示的に渡す）。
// area_idはtype問わず必須（Issue #204でclosedグループにもエリア紐付けを
// 必須化したため、常にareaIdをそのまま渡す）
export async function createGroup(
  name: string,
  ownerUserId: string,
  type: GroupType = 'closed',
  areaId: string | null = null
): Promise<Group> {
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      owner_user_id: ownerUserId,
      name,
      invite_code: generateInviteCode(),
      type,
      area_id: areaId,
      expires_at: type === 'open' ? computeOpenGroupExpiresAt(new Date()) : null,
    })
    .select()
    .single();
  if (groupError) throw groupError;

  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: ownerUserId, invited_by: null, status: 'approved' });
  if (memberError) throw memberError;

  return group as Group;
}

// invite_codeからオープングループを検索する（Issue #148、QRでの即時参加）。
// security definerなRPC（find_open_group_by_invite_code）経由のため、
// 参加前（まだメンバーでない）でもtype='open'のグループに限り検索できる
export async function findOpenGroupByInviteCode(
  inviteCode: string
): Promise<{ id: string; name: string; area_id: string } | null> {
  const { data, error } = await supabase.rpc('find_open_group_by_invite_code', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ?? null;
}

// オープングループにQRコード（invite_code）で即時参加する（承認不要、Issue #148）。
// あわせてグループのarea_idをuser_areasに登録し、以後そのエリアを監視対象にする
// （Issue #190で発見：参加しただけではarea監視が始まらず、presence_logsが
// 一切書き込まれないため在席者一覧に自分が表示されない不具合があった。
// グループのownerは作成時に自分のareaを既にuser_areas登録済みのため影響を
// 受けていなかった）
export async function joinOpenGroup(groupId: string, userId: string, areaId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, invited_by: null, status: 'approved' });
  if (error) throw error;

  const { error: userAreaError } = await supabase
    .from('user_areas')
    .upsert({ user_id: userId, area_id: areaId }, { onConflict: 'user_id,area_id', ignoreDuplicates: true });
  if (userAreaError) throw userAreaError;
}

// 期限切れ（expires_at <= now）のオープングループのうち、自分がowner_user_idの
// ものを削除する（Issue #148の自動削除。RLSのDELETE権限はowner限定のため、
// 他ユーザーが所有するグループは削除できない＝そのowner自身がアプリを開いた
// タイミングで削除される想定）
export async function deleteExpiredOwnedOpenGroups(ownerUserId: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('owner_user_id', ownerUserId)
    .eq('type', 'open')
    .lte('expires_at', new Date().toISOString());
  if (error) throw error;
}

// 既存メンバーが友達を招待する（Issue #117）。owner・approvedメンバーのみ
// invited_by付きでinsertできる（RLS: users can request to join or be invited by owner/members）
export async function inviteMember(groupId: string, friendUserId: string, invitedByUserId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: friendUserId, invited_by: invitedByUserId, status: 'pending' });
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

// そのグループ内限定の表示名・アイコンを設定する（Issue #150、任意項目）。
// 参加（招待承諾／QR参加）の直後に呼ぶ想定で、どちらも未指定ならUSERS側に
// フォールバックしたいだけなので、呼び出し側は値がある項目だけ渡せばよい
export async function updateMemberDisplay(
  memberId: string,
  displayName: string | null,
  displayIconUrl: string | null
): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ display_name: displayName, display_icon_url: displayIconUrl })
    .eq('id', memberId);
  if (error) throw error;
}

// グループ内限定の表示アイコンをavatarsバケットにアップロードする。
// パスはプロフィールアイコンと衝突しないよう`{user_id}/group-{member_id}.jpg`にする
// （書き込み可否はフォルダ名=auth.uid()のみで判定されるため、この命名で問題ない）
export async function uploadMemberDisplayIcon(
  userId: string,
  memberId: string,
  localUri: string
): Promise<string> {
  return uploadIconToAvatarsBucket(`${userId}/group-${memberId}.jpg`, localUri);
}

// あるエリアに現在在籍中（exited_at is null）のuser_id集合を取得する
// （Issue #148、オープングループの在席状況フィルタ用。RLS上「presence in
// monitored areas is readable」で絞り込み済みの結果が返る＝自分がそのエリアを
// 監視(USER_AREAS)していなければ、自分以外の行はそもそも読めない）
export async function fetchPresentUserIds(areaId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('presence_logs')
    .select('user_id')
    .eq('area_id', areaId)
    .is('exited_at', null);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.user_id));
}
