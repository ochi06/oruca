import { ensureSignedIn } from './auth';
import { supabase } from './supabase';

export type JoinAreaResult = 'joined' | 'already_joined';

// GeofenceScreen.tsxのhandleJoinDemoArea相当のuser_areasへのinsert処理を、
// QRコード/コード入力からの参加（Issue #65）でも使えるよう切り出したもの
export async function joinArea(areaId: string): Promise<JoinAreaResult> {
  const userId = await ensureSignedIn();
  const { error } = await supabase.from('user_areas').insert({ user_id: userId, area_id: areaId });
  if (error) {
    // 23505 = unique_violation。unique(user_id, area_id)により、
    // 参加済みエリアへの再insertはこのエラーになる（失敗ではなく想定内の状態）
    if (error.code === '23505') {
      return 'already_joined';
    }
    throw error;
  }
  return 'joined';
}
