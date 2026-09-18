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
import { CURRENT_USER_ID } from '../mocks/presence';
import { usePresenceStore } from '../store/usePresenceStore';
import { LatLng } from '../utils/geo';

type PermissionState = 'checking' | 'granted' | 'denied';

// デモ用に事前投入済みのエリア（神戸市産業振興センター）。本来はエリアの
// 検索・QRコード読み取りなどで見つける想定だが、今回は時間の都合で
// このIDに固定している（本格的な導線はUS-018の後続タスクで整備）。
const DEMO_AREA_ID = 'c06fe2ac-fff3-42a8-b5ea-00756b9396e4';

export default function GeofenceScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const monitoredAreaIds = mockUserAreas
    .filter((userArea) => userArea.user_id === CURRENT_USER_ID)
    .map((userArea) => userArea.area_id);
  const areas = mockAreas.filter((area) => monitoredAreaIds.includes(area.id));

  const [permission, setPermission] = useState<PermissionState>('checking');
  const [joining, setJoining] = useState(false);
  // 在席ログはUS-001（app/store/usePresenceStore.ts）と共有する。
  // ここで検知した入退室が、在席一覧画面にもそのまま反映されるようにするため
  const logs = usePresenceStore((state) => state.presenceLogs);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  function handleLocation(location: LatLng) {
    const now = new Date().toISOString();
    // watchPositionAsyncのコールバックはuseEffect実行時点のクロージャなので、
    // storeから最新のpresenceLogsを都度取得する（レンダー時のlogsは古い可能性がある）
    const prevLogs = usePresenceStore.getState().presenceLogs;
    let updatedLogs = prevLogs;
    for (const area of areas) {
      const inside = isInsideArea(location, area);
      updatedLogs = recordPresence(updatedLogs, CURRENT_USER_ID, area, inside, now);
    }
    if (updatedLogs !== prevLogs) {
      usePresenceStore.getState().setPresenceLogs(updatedLogs);
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
          label={joining ? '参加中…' : 'このエリアに参加する'}
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
