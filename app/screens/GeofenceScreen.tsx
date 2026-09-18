import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';

import { ErrorState } from '../components/ErrorState';
import { ListItem } from '../components/ListItem';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { isInsideArea, recordPresence } from '../geofence';
import { Area, mockAreas, mockUserAreas } from '../mocks/areas';
import { PresenceLog, mockPresenceLogs } from '../mocks/presenceLogs';
import { LatLng } from '../utils/geo';

const CURRENT_USER_ID = 'user-1';

type PermissionState = 'checking' | 'granted' | 'denied';

export default function GeofenceScreen() {
  const { colors } = useTheme();
  const monitoredAreaIds = mockUserAreas
    .filter((userArea) => userArea.user_id === CURRENT_USER_ID)
    .map((userArea) => userArea.area_id);
  const areas = mockAreas.filter((area) => monitoredAreaIds.includes(area.id));

  const [permission, setPermission] = useState<PermissionState>('checking');
  const [logs, setLogs] = useState<PresenceLog[]>(mockPresenceLogs);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  function handleLocation(location: LatLng) {
    const now = new Date().toISOString();
    setLogs((prevLogs) => {
      let updatedLogs = prevLogs;
      for (const area of areas) {
        const inside = isInsideArea(location, area);
        updatedLogs = recordPresence(updatedLogs, CURRENT_USER_ID, area, inside, now);
      }
      return updatedLogs;
    });
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
