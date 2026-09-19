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

// ユーザーが実際に参加している（USER_AREASに行がある）エリアを全件取得する
// （Issue #109）。usePresenceStore.tsのfetchMonitoredArea（在席画面表示用、
// 最も古い1件のみ）とは異なり、ジオフェンス監視は複数エリアを同時に見る
// 必要があるため、同じ「user_areas→areas」の2段階クエリを全件版にしたもの
export async function fetchMonitoredAreas(userId: string): Promise<Area[]> {
  const { data: userAreas, error: userAreasError } = await supabase
    .from('user_areas')
    .select('area_id')
    .eq('user_id', userId);
  if (userAreasError) {
    throw userAreasError;
  }

  const areaIds = (userAreas ?? []).map((userArea) => userArea.area_id);
  if (areaIds.length === 0) {
    return [];
  }

  const { data: areas, error: areasError } = await supabase.from('areas').select('*').in('id', areaIds);
  if (areasError) {
    throw areasError;
  }
  return (areas ?? []) as Area[];
}
