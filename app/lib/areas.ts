import { supabase } from './supabase';
import { Area } from '../mocks/areas';
import { roundCoordinate } from '../utils/geo';
import { matchesSearchQuery } from '../utils/search';

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

// 指定したIDのエリアをまとめて取得する（Issue #340）。RLS上読めない
// （所有・監視中でも、自分宛のpending/approvedなFRIEND_AREA_LINKSも無い）
// エリアは単に結果から外れる
export async function fetchAreasByIds(areaIds: string[]): Promise<Area[]> {
  if (areaIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase.from('areas').select('*').in('id', areaIds);
  if (error) {
    throw error;
  }
  return (data ?? []) as Area[];
}

// 公開済み（is_public=true）のエリアを名前の部分一致で検索する（Issue #333）。
// AreaRegistrationScreenの「既存の公開エリアを検索して選択する」機能用。
// RLS側に"public areas are readable by anyone"ポリシーが無いと、他ユーザー
// 所有のis_public=trueエリアはここでも0件になる点に注意
// （supabase/migrations/20261003010000_public_areas_readable.sql参照）。
//
// Issue #335：ひらがな／カタカナ等の表記揺れを吸収したあいまいマッチに
// するため、PostgreSQLのilikeでは行わず（Unicodeのスクリプト正規化が
// できないため）、is_public=trueの全件を取得してからクライアント側で
// matchesSearchQuery（utils/kana.tsの正規化込み）でフィルタする
export async function searchPublicAreas(query: string): Promise<Area[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('is_public', true)
    .order('name', { ascending: true });
  if (error) {
    throw error;
  }
  return ((data ?? []) as Area[]).filter((area) => matchesSearchQuery(area.name, trimmed));
}

// 指定したエリアが既に自分の監視対象（USER_AREAS）に入っているかを調べる
// （Issue #333、検索で選んだ既存エリアの重複登録防止用）
export async function isAreaMonitored(userId: string, areaId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_areas')
    .select('id')
    .eq('user_id', userId)
    .eq('area_id', areaId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data !== null;
}

// 検索で選んだ既存エリアを、自分の監視対象（USER_AREAS）に追加する
// （Issue #333）。新規にareasをinsertするcreateAreaInBackendとは別物
export async function monitorExistingArea(userId: string, areaId: string): Promise<void> {
  const { error } = await supabase.from('user_areas').insert({ user_id: userId, area_id: areaId });
  if (error) {
    throw error;
  }
}

// ユーザーが実際に参加している（USER_AREASに行がある）エリアを全件取得する
// （Issue #109）。ジオフェンス監視は複数エリアを同時に見る必要があるため、
// 「user_areas→areas」の2段階クエリを全件版にしたもの
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
