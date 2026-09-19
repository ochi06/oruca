import { ensureSignedIn } from './auth';
import { supabase } from './supabase';
import { Area } from '../mocks/areas';

export type JoinAreaResult = 'joined' | 'already_joined';

// 自分が作成した（owner_user_id = 自分）エリア一覧を取得する（Issue #50）
export async function fetchOwnedAreas(userId: string): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []) as Area[];
}

export type AreaUpdate = {
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
};

// docs/schema.md「AREAS」の丸めルール：座標は小数点以下6桁、半径は整数
function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

// エリアの名前・中心座標・半径を更新する（Issue #50）。所有者以外はRLSにより弾かれる
export async function updateArea(areaId: string, update: AreaUpdate): Promise<void> {
  const { error } = await supabase
    .from('areas')
    .update({
      name: update.name,
      center_lat: roundCoordinate(update.center_lat),
      center_lng: roundCoordinate(update.center_lng),
      radius_m: Math.round(update.radius_m),
    })
    .eq('id', areaId);
  if (error) {
    throw error;
  }
}

// エリアを削除する（Issue #50）。USER_AREAS・FRIEND_AREA_LINKS・PRESENCE_LOGSは
// いずれもarea_idにON DELETE CASCADEが設定済みのため、アプリ側で個別に消す必要はない
// （supabase/migrations/20260918150538_initial_schema.sql参照）
export async function deleteArea(areaId: string): Promise<void> {
  const { error } = await supabase.from('areas').delete().eq('id', areaId);
  if (error) {
    throw error;
  }
}

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
