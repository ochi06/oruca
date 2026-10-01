import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';

import { isInsideArea, recordPresence } from '../geofence';
import { ensureSignedIn } from '../lib/auth';
import { fetchMonitoredAreas } from '../lib/areas';
import { fetchOpenPresenceLogs } from '../lib/presence';
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

  // Issue #166：入室中ログの状態（JSXから参照されないため再レンダーは不要）。
  // 以前はuseStateで持っていたが、バックエンドへの書き込み成否に関わらず
  // 常に「成功した体」でここを更新していたため、recordEntryInBackend/
  // recordExitInBackendが失敗した場合に、ローカルの状態とDBの実際の状態が
  // 永続的にズレてしまうバグがあった（アプリ再起動でこの変数がリセットされる
  // までズレが直らない）。書き込みが成功したエリアのみ更新する方式にしたため、
  // refで十分
  const logsRef = useRef<PresenceLog[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // ユーザーの監視対象エリアを取得し、USER_AREASへの参加・離脱に追従して
  // 再取得する（Issue #109）。user_areasテーブルの変更をRealtimeで購読する
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadAreasAndSubscribe() {
      const userId = await ensureSignedIn();
      if (cancelled) return;
      userIdRef.current = userId;

      // Issue #178: 入退室状態（logsRef）はメモリ内でしか管理していないため、
      // アプリ再起動を挟むと「入室中だったこと」を忘れ、本来必要な退室時の
      // exited_at書き込みが行われなくなる。起動時にDBの入室中
      // （exited_atがnull）ログを読み込んでlogsRefに復元（hydrate）する
      try {
        const openLogs = await fetchOpenPresenceLogs(userId);
        if (!cancelled) {
          logsRef.current = openLogs;
        }
      } catch {
        // 復元に失敗しても致命的ではない（次回の入退室判定時に
        // ズレていればrecordEntryInBackend/recordExitInBackend側で
        // 整合する。読み込み自体はここでは再試行しない）
      }

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

  // Issue #166：タブ切替直後などに在席表示が反映されず、アプリ再起動が
  // 必要になる不具合の修正。
  //
  // 以前は「ローカルのlogsをまず書き換え（入室/退室したことにする）→
  // その後バックエンドへ書き込む」という順序だったため、バックエンドへの
  // 書き込みが（ネットワーク瞬断等で）失敗しても、ローカルのlogsは
  // 「既に書き込み済み」のまま進んでしまっていた。次にこのエリアに
  // 留まり続けている間は「留まっている（staying）」としてしか扱われず
  // （recordLocationUpdateInBackendが呼ばれ続けるだけ）、本来必要だった
  // 入室insertが二度と再試行されない。しかもrecordLocationUpdateInBackendは
  // `exited_at is null`の行をUPDATEするだけなので、該当行自体が存在しない
  // （insertが失敗したため）場合は何も更新せず静かに成功してしまい、
  // 失敗に気づく手段がなかった（アプリ再起動でlogsRefが空に戻るまでズレが残る）。
  //
  // 修正後は、エリアごとにバックエンドへの書き込みが成功した場合のみ
  // logsRef.currentを更新する。失敗した場合は該当エリアの状態を変更しない
  // ため、次回のwatchPositionAsyncコールバックで同じ入室/退室として
  // 再評価・再試行される
  async function handleLocation(location: LatLng) {
    const userId = userIdRef.current;
    if (!userId) return;

    const now = new Date().toISOString();

    for (const area of areasRef.current) {
      const inside = isInsideArea(location, area);
      const wasOpen = hasOpenLog(logsRef.current, userId, area.id);

      if (inside === wasOpen) {
        // 変化なし。ただし在室継続中は位置情報を更新する
        if (wasOpen) {
          try {
            await recordLocationUpdateInBackend(area.id, location);
          } catch {
            // 位置情報の更新のみの失敗は致命的ではない（次のtickで再試行される）
          }
        }
        continue;
      }

      try {
        if (inside) {
          await recordEntryInBackend(area.id, location, now);
        } else {
          await recordExitInBackend(area.id, now);
        }
        // バックエンドへの書き込みが成功した場合のみ、ローカルの状態を進める
        logsRef.current = recordPresence(logsRef.current, userId, area, inside, now);
      } catch {
        // 書き込みに失敗した場合はローカルの状態を変更しない。
        // 次回のコールバックで同じ入室/退室として再試行される
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
