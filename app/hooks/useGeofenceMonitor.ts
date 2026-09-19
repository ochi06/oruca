import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';

import { isInsideArea, recordPresence } from '../geofence';
import { ensureSignedIn } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { mockAreas, mockUserAreas } from '../mocks/areas';
import { CURRENT_USER_ID, PresenceLog } from '../mocks/presence';
import { LatLng } from '../utils/geo';

// デモ用に事前投入済みのエリア（神戸市産業振興センター）。本来はエリアの
// 検索・QRコード読み取りなどで見つける想定だが、今回は時間の都合で
// このIDに固定している（本格的な導線はUS-018の後続タスクで整備）。
const DEMO_AREA_ID = 'c06fe2ac-fff3-42a8-b5ea-00756b9396e4';

// モックのエリアID（geofence判定に使っている app/mocks/areas.ts 側のID）と、
// 実際にSupabaseへ投入済みのエリアIDの対応。今はデモ用の1件のみ実データが
// あるため、area-1（部室）だけを対応させている。エリア登録機能（US-018）が
// 一通り繋がった後は、この対応表自体が不要になる想定
const BACKEND_AREA_IDS: Record<string, string> = {
  'area-1': DEMO_AREA_ID,
};

// 入室時：presence_logsに新しい行をinsertする
async function recordEntryInBackend(areaId: string, location: LatLng, enteredAt: string): Promise<void> {
  const userId = await ensureSignedIn();
  const { error } = await supabase.from('presence_logs').insert({
    user_id: userId,
    area_id: areaId,
    lat: location.latitude,
    lng: location.longitude,
    entered_at: enteredAt,
  });
  if (error) {
    throw error;
  }
}

// 退室時：入室中（exited_atがnull）の行を探してexited_atを更新する
async function recordExitInBackend(areaId: string, exitedAt: string): Promise<void> {
  const userId = await ensureSignedIn();
  const { error } = await supabase
    .from('presence_logs')
    .update({ exited_at: exitedAt })
    .eq('user_id', userId)
    .eq('area_id', areaId)
    .is('exited_at', null);
  if (error) {
    throw error;
  }
}

function hasOpenLog(logs: PresenceLog[], areaId: string): boolean {
  return logs.some(
    (log) => log.user_id === CURRENT_USER_ID && log.area_id === areaId && log.exited_at === null
  );
}

// タブ切り替えでアンマウントされて監視が止まってしまわないよう、ログイン後は
// どのタブを見ていても常時マウントされる場所（App.tsx）から呼び出す想定
// （US-004、独立タブを持たない横断的な機能。docs/architecture.md参照、Issue #73）。
// enabledはログイン完了前に位置情報の許可を要求してしまわないためのガード
export function useGeofenceMonitor(enabled: boolean): void {
  const monitoredAreaIds = mockUserAreas
    .filter((userArea) => userArea.user_id === CURRENT_USER_ID)
    .map((userArea) => userArea.area_id);
  const areas = mockAreas.filter((area) => monitoredAreaIds.includes(area.id));

  // このリストはこのフック専用のローカル状態（モックのCURRENT_USER_ID・エリアID
  // を使っている）。実際のバックエンドへの反映はrecordEntryInBackend/
  // recordExitInBackendがpresence_logsに書き込み、usePresenceStore側はその
  // Realtime購読で独立して最新化される（詳細はusePresenceStore.tsのinitialize参照）
  const [logs, setLogs] = useState<PresenceLog[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  async function handleLocation(location: LatLng) {
    const now = new Date().toISOString();
    let updatedLogs: PresenceLog[] = [];
    const transitions: { areaId: string; entered: boolean }[] = [];

    // setLogsのコールバックはuseEffect実行時点のクロージャではなく、常に
    // 最新のstateを受け取れるため、ここで最新のlogsを基準に計算する
    setLogs((prevLogs) => {
      updatedLogs = prevLogs;
      for (const area of areas) {
        const inside = isInsideArea(location, area);
        const wasOpen = hasOpenLog(updatedLogs, area.id);
        updatedLogs = recordPresence(updatedLogs, CURRENT_USER_ID, area, inside, now);
        const isOpenNow = hasOpenLog(updatedLogs, area.id);
        if (wasOpen !== isOpenNow) {
          transitions.push({ areaId: area.id, entered: isOpenNow });
        }
      }
      return updatedLogs;
    });

    for (const { areaId, entered } of transitions) {
      const backendAreaId = BACKEND_AREA_IDS[areaId];
      if (!backendAreaId) continue;
      try {
        if (entered) {
          await recordEntryInBackend(backendAreaId, location, now);
        } else {
          await recordExitInBackend(backendAreaId, now);
        }
      } catch {
        // バックエンドへの書き込みが失敗しても、モック側の在席判定はそのまま
        // 継続させる（オフライン等で失敗しても監視自体は壊れないように）
      }
    }
  }

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function requestPermissionAndWatch() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        Alert.alert(
          '位置情報が必要です',
          'エリア内にいるかどうかの判定に位置情報の利用許可が必要です。設定アプリから許可してください。'
        );
        return;
      }

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (result) => {
          handleLocation({
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          });
        }
      );

      if (cancelled) {
        subscription.remove();
        return;
      }
      subscriptionRef.current = subscription;
    }

    requestPermissionAndWatch();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
