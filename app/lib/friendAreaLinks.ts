import { supabase } from './supabase';
import { FriendAreaLink } from '../mocks/presence';

// 自分が関わる（initiator_id/friend_idいずれか）FRIEND_AREA_LINKSを全件取得する
// （Issue #221）。pending/approved/rejectedすべて含む。RLS
// （"users can manage their own friend_area_links"）が自分の関わる行のみに
// 絞り込み済みのため、ここでは追加の絞り込みは行わない
export async function fetchMyFriendAreaLinks(userId: string): Promise<FriendAreaLink[]> {
  const { data, error } = await supabase
    .from('friend_area_links')
    .select('*')
    .or(`initiator_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) {
    throw error;
  }
  return (data ?? []) as FriendAreaLink[];
}

// 友達にエリアの紐づけを提案する（Issue #221）。RLSのwith checkで
// initiator_id = auth.uid()が強制されるため、提案者は常に自分になる
export async function proposeFriendAreaLink(
  initiatorId: string,
  friendId: string,
  areaId: string
): Promise<void> {
  const { error } = await supabase
    .from('friend_area_links')
    .insert({ initiator_id: initiatorId, friend_id: friendId, area_id: areaId, status: 'pending' });
  if (error) {
    throw error;
  }
}

// 提案を承認する（Issue #221）。RLS（"friends can approve links proposed to
// them"）により、friend_id = auth.uid()の行のみ更新できる。
//
// 承認者が未監視のエリアだった場合も、承認した時点でそのエリアの在席検知・
// 表示の対象に含める必要があるため、USER_AREASへも自動登録する（Issue #340、
// オープングループ参加時のjoinOpenGroup（app/lib/groups.ts）と同じ考え方）。
// approverIdはfriend_id（＝auth.uid()）そのものだが、RLSのwith checkではなく
// upsertの対象行を明示するために引数で受け取る
export async function approveFriendAreaLink(linkId: string, approverId: string, areaId: string): Promise<void> {
  const { error } = await supabase.from('friend_area_links').update({ status: 'approved' }).eq('id', linkId);
  if (error) {
    throw error;
  }

  const { error: userAreaError } = await supabase
    .from('user_areas')
    .upsert({ user_id: approverId, area_id: areaId }, { onConflict: 'user_id,area_id', ignoreDuplicates: true });
  if (userAreaError) {
    throw userAreaError;
  }
}

// 提案を拒否する（Issue #221）
export async function rejectFriendAreaLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('friend_area_links').update({ status: 'rejected' }).eq('id', linkId);
  if (error) {
    throw error;
  }
}
