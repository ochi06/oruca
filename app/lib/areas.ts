import { supabase } from './supabase';
import { Area } from '../mocks/areas';
import { roundCoordinate } from '../utils/geo';

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
