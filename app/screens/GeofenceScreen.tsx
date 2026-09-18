import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { ListItem } from '../components/ListItem';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Screen } from '../components/Screen';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { isInsideArea, recordPresence } from '../geofence';
import { ensureSignedIn } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Area, mockAreas, mockUserAreas } from '../mocks/areas';
import { CURRENT_USER_ID, PresenceLog } from '../mocks/presence';
import { LatLng } from '../utils/geo';

type PermissionState = 'checking' | 'granted' | 'denied';

// デモ用に事前投入済みのエリア（神戸市産業振興センター）。本来はエリアの
// 検索・QRコード読み取りなどで見つける想定だが、今回は時間の都合で
// このIDに固定している（本格的な導線はUS-018の後続タスクで整備）。
const DEMO_AREA_ID = 'c06fe2ac-fff3-42a8-b5ea-00756b9396e4';
const DEMO_AREA_NAME = '神戸市産業振興センター';

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

export default function GeofenceScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const monitoredAreaIds = mockUserAreas
    .filter((userArea) => userArea.user_id === CURRENT_USER_ID)
    .map((userArea) => userArea.area_id);
  const areas = mockAreas.filter((area) => monitoredAreaIds.includes(area.id));

  const [permission, setPermission] = useState<PermissionState>('checking');
  const [joining, setJoining] = useState(false);
  // このリストはこの画面専用のローカル状態（モックのCURRENT_USER_ID・エリアID
  // を使っている）。以前はUS-001のusePresenceStoreと共有していたが、US-001が
  // 実際のSupabaseデータ（実UUIDのarea_id/user_id）で動くようになったため、
  // モックIDのログをそのままstoreに書き込むと実データと混ざって壊れてしまう。
  // 実際のバックエンドへの反映はrecordEntryInBackend/recordExitInBackendが
  // presence_logsに書き込み、usePresenceStore側はそのRealtime購読で
  // 独立して最新化される（詳細はusePresenceStore.tsのinitialize参照）
  const [logs, setLogs] = useState<PresenceLog[]>([]);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  function hasOpenLog(logs: PresenceLog[], areaId: string): boolean {
    return logs.some(
      (log) => log.user_id === CURRENT_USER_ID && log.area_id === areaId && log.exited_at === null
    );
  }

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
        // バックエンドへの書き込みが失敗しても、モック側の在席表示（画面）は
        // そのまま継続させる（オフライン等で失敗しても画面が壊れないように）
      }
    }
  }

  async function requestPermissionAndWatch(isCancelled: () => boolean) {
    setPermission('checking');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (isCancelled()) return;

    if (status !== 'granted') {
      setPermission('denied');
      return;
    }

    setPermission('granted');
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (result) => {
        handleLocation({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        });
      }
    );

    if (isCancelled()) {
      subscription.remove();
      return;
    }
    subscriptionRef.current = subscription;
  }

  useEffect(() => {
    let cancelled = false;
    requestPermissionAndWatch(() => cancelled);
    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoinDemoArea() {
    setJoining(true);
    try {
      const userId = await ensureSignedIn();
      const { error } = await supabase
        .from('user_areas')
        .insert({ user_id: userId, area_id: DEMO_AREA_ID });
      if (error) {
        // 23505 = unique_violation。unique(user_id, area_id)により、
        // 参加済みエリアへの再insertはこのエラーになる（失敗ではなく想定内の状態）
        if (error.code === '23505') {
          showToast('すでに参加しています');
          return;
        }
        throw error;
      }
      showToast('エリアに参加しました');
    } catch {
      showToast('エリアへの参加に失敗しました');
    } finally {
      setJoining(false);
    }
  }

  function isPresent(area: Area): boolean {
    return logs.some(
      (log) =>
        log.user_id === CURRENT_USER_ID &&
        log.area_id === area.id &&
        log.exited_at === null
    );
  }

  if (permission === 'checking') {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (permission === 'denied') {
    return (
      <Screen style={styles.container}>
        <ErrorState
          message="位置情報の利用が許可されていません。エリア内にいるかどうかの判定に位置情報の許可が必要です。"
          onRetry={() => requestPermissionAndWatch(() => false)}
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>ジオフェンス判定</Text>

      <View style={styles.joinButton}>
        <Button
          label={joining ? '参加中…' : `「${DEMO_AREA_NAME}」に参加する`}
          onPress={handleJoinDemoArea}
          disabled={joining}
        />
      </View>

      <FlatList
        data={areas}
        keyExtractor={(area) => area.id}
        renderItem={({ item: area }) => (
          <ListItem
            title={area.name}
            subtitle={isPresent(area) ? '在席中' : '不在'}
            trailing={
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isPresent(area) ? colors.green : colors.textSub },
                ]}
              />
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  joinButton: {
    marginBottom: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
