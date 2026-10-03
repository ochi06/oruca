import { supabase } from './supabase';
import { ensureSignedIn } from './auth';
import { PresenceLog } from '../mocks/presence';
import { Area } from '../mocks/areas';
import {
  AreaPresentUser,
  buildAreaPresentUsers,
  buildPresenceMarkers,
  PresenceLocation,
  PresenceMarker,
} from '../utils/presenceMarkers';

// Issue #178: アプリ起動時、自分の入室中（exited_atがnull）ログをDBから
// 読み込み、useGeofenceMonitorのlogsRefをhydrateするために使う
export async function fetchOpenPresenceLogs(userId: string): Promise<PresenceLog[]> {
  const { data, error } = await supabase
    .from('presence_logs')
    .select('*')
    .eq('user_id', userId)
    .is('exited_at', null);
  if (error) {
    throw error;
  }
  return (data ?? []) as PresenceLog[];
}

export type PresenceMapData = {
  currentUserId: string;
  areas: Area[];
  markers: PresenceMarker[];
  // エリアID→そのエリアの在席者一覧（Issue #120のポップアップ・フルリスト用）
  areaPresence: Record<string, AreaPresentUser[]>;
  // エリアID→そのエリアの在席者マーカー（lat/lng付き）。1件のエリアに絞った表示
  // （Issue #261：友達/グループ一覧からの絞り込み・マップ内検索で共用）で使う
  markersByArea: Record<string, PresenceMarker[]>;
};

// 自分が参加している全エリア（USER_AREAS）と、その中の在席者をまとめて取得する
// （Issue #62、usePresenceStoreから利用）
export async function fetchPresenceMapData(): Promise<PresenceMapData> {
  const currentUserId = await ensureSignedIn();

  const { data: userAreas, error: userAreasError } = await supabase
    .from('user_areas')
    .select('area_id')
    .eq('user_id', currentUserId);
  if (userAreasError) throw userAreasError;

  const areaIds = Array.from(new Set((userAreas ?? []).map((row) => row.area_id)));
  if (areaIds.length === 0) {
    return { currentUserId, areas: [], markers: [], areaPresence: {}, markersByArea: {} };
  }

  const { data: areas, error: areasError } = await supabase
    .from('areas')
    .select('id, owner_user_id, name, center_lat, center_lng, radius_m, is_public, created_at, updated_at')
    .in('id', areaIds);
  if (areasError) throw areasError;

  const { data: locations, error: presenceError } = await supabase
    .from('presence_logs')
    .select('user_id, area_id, lat, lng')
    .in('area_id', areaIds)
    .is('exited_at', null);
  if (presenceError) throw presenceError;

  const presenceLocations = (locations ?? []) as (PresenceLocation & { area_id: string })[];
  const userIds = Array.from(new Set(presenceLocations.map((location) => location.user_id)));

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select(
      'id, name, icon_url, status, schedule_note, status_message, is_anonymous, allow_entry_notifications, created_at, updated_at'
    )
    .in('id', userIds.length > 0 ? userIds : ['']);
  if (usersError) throw usersError;

  // usersはRLS（FRIEND_AREA_LINKS.status='approved'の相手、同じグループの
  // メンバー、または自分自身）で既に絞り込まれているため、ここではその結果を
  // そのまま「表示してよい相手」として扱う。
  //
  // Issue #437：匿名モード中（is_anonymous）の相手は、自分自身でない限り
  // 「名前を隠す」のではなく「存在（マーカー）自体を隠す」必要がある
  // （docs/schema.md：trueの間は名前だけでなく在席も非表示）。visibleUserIds
  // （名前を見せてよい相手）とhiddenUserIds（マーカーごと除外する相手）を
  // 分けて扱う
  const visibleUserIds = new Set(
    users?.filter((user) => user.id === currentUserId || !user.is_anonymous).map((user) => user.id) ?? []
  );
  const hiddenUserIds = new Set(
    users?.filter((user) => user.id !== currentUserId && user.is_anonymous).map((user) => user.id) ?? []
  );

  const markers = buildPresenceMarkers(currentUserId, presenceLocations, visibleUserIds, hiddenUserIds, users ?? []);

  const areaPresence: Record<string, AreaPresentUser[]> = {};
  // エリア1件に絞った表示（Issue #261）用に、エリアごとのマーカー（lat/lng付き）も
  // 同じループでまとめて作る。再フェッチせずクライアント側で絞り込めるようにするため
  const markersByArea: Record<string, PresenceMarker[]> = {};
  for (const areaId of areaIds) {
    const areaLocations = presenceLocations.filter((location) => location.area_id === areaId);
    const areaUserIds = Array.from(new Set(areaLocations.map((location) => location.user_id)));
    areaPresence[areaId] = buildAreaPresentUsers(currentUserId, areaUserIds, visibleUserIds, hiddenUserIds, users ?? []);
    markersByArea[areaId] = buildPresenceMarkers(currentUserId, areaLocations, visibleUserIds, hiddenUserIds, users ?? []);
  }

  return { currentUserId, areas: (areas ?? []) as Area[], markers, areaPresence, markersByArea };
}
