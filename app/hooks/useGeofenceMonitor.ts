import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';

import { isInsideArea, recordPresence } from '../geofence';
import { ensureSignedIn } from '../lib/auth';
import { fetchMonitoredAreas } from '../lib/areas';
import { supabase } from '../lib/supabase';
import { Area } from '../mocks/areas';
import { PresenceLog } from '../mocks/presence';
import { LatLng } from '../utils/geo';

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

// 在室中：入室中（exited_atがnull）の行のlat/lngを最新の位置に更新する
// （Issue #74）。更新頻度は間引かず、watchPositionAsyncのコールバックが
// 発火するたび（既にtimeInterval/distanceIntervalで間引き済み）に更新する
async function recordLocationUpdateInBackend(areaId: string, location: LatLng): Promise<void> {
  const userId = await ensureSignedIn();
  const { error } = await supabase
    .from('presence_logs')
    .update({ lat: location.latitude, lng: location.longitude })
    .eq('user_id', userId)
    .eq('area_id', areaId)
    .is('exited_at', null);
  if (error) {
    throw error;
  }
}

function hasOpenLog(logs: PresenceLog[], userId: string, areaId: string): boolean {
  return logs.some((log) => log.user_id === userId && log.area_id === areaId && log.exited_at === null);
}

// タブ切り替えでアンマウントされて監視が止まってしまわないよう、ログイン後は
// どのタブを見ていても常時マウントされる場所（App.tsx）から呼び出す想定
// （US-004、独立タブを持たない横断的な機能。docs/architecture.md参照、Issue #73）。
// enabledはログイン完了前に位置情報の許可を要求してしまわないためのガード
export function useGeofenceMonitor(enabled: boolean): void {
  // ログイン中ユーザーが実際に参加しているエリア（USER_AREAS）。ここはこの
  // フック内でしか参照しない値なので、再レンダーを起こさないrefで持つ
  // （Issue #109、以前はapp/mocks/areas.tsの固定モックを使っていた）
  const userIdRef = useRef<string | null>(null);
  const areasRef = useRef<Area[]>([]);

  const [logs, setLogs] = useState<PresenceLog[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // ユーザーの監視対象エリアを取得し、USER_AREASへの参加・離脱に追従して
  // 再取得する（Issue #109）。usePresenceStore.tsのpresence_logs購読と同じ
  // パターンで、user_areasテーブルの変更をRealtimeで購読する
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadAreasAndSubscribe() {
      const userId = await ensureSignedIn();
      if (cancelled) return;
      userIdRef.current = userId;

      async function refetchAreas() {
        const monitoredAreas = await fetchMonitoredAreas(userId);
        if (!cancelled) {
          areasRef.current = monitoredAreas;
        }
      }

      await refetchAreas();
      if (cancelled) return;

      channel = supabase
        .channel(`user_areas:user:${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_areas', filter: `user_id=eq.${userId}` },
          () => {
            refetchAreas();
          }
        )
        .subscribe();
    }

    loadAreasAndSubscribe();

    return () => {
      cancelled = true;
      channel?.unsubscribe();
    };
  }, [enabled]);

  async function handleLocation(location: LatLng) {
    const userId = userIdRef.current;
    if (!userId) return;

    const now = new Date().toISOString();
    let updatedLogs: PresenceLog[] = [];
    const transitions: { areaId: string; entered: boolean }[] = [];
    const staying: string[] = [];

    // setLogsのコールバックはuseEffect実行時点のクロージャではなく、常に
    // 最新のstateを受け取れるため、ここで最新のlogsを基準に計算する
    setLogs((prevLogs) => {
      updatedLogs = prevLogs;
      for (const area of areasRef.current) {
        const inside = isInsideArea(location, area);
        const wasOpen = hasOpenLog(updatedLogs, userId, area.id);
        updatedLogs = recordPresence(updatedLogs, userId, area, inside, now);
        const isOpenNow = hasOpenLog(updatedLogs, userId, area.id);
        if (wasOpen !== isOpenNow) {
          transitions.push({ areaId: area.id, entered: isOpenNow });
        } else if (wasOpen && isOpenNow) {
          staying.push(area.id);
        }
      }
      return updatedLogs;
    });

    for (const { areaId, entered } of transitions) {
      try {
        if (entered) {
          await recordEntryInBackend(areaId, location, now);
        } else {
          await recordExitInBackend(areaId, now);
        }
      } catch {
        // バックエンドへの書き込みが失敗しても、ローカルの在席判定はそのまま
        // 継続させる（オフライン等で失敗しても監視自体は壊れないように）
      }
    }

    for (const areaId of staying) {
      try {
        await recordLocationUpdateInBackend(areaId, location);
      } catch {
        // 同上、失敗してもローカルの在席判定・監視自体は継続させる
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

      // Issue #90: Balancedだとネットワークベース測位に倒れ、環境によっては
      // OSレベルの位置情報登録自体がサイレントに失敗する（エミュレーターで確認）。
      // Highに固定してGPS優先の測位を強制する
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
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
