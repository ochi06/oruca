import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { ListItem } from '../components/ListItem';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { isInsideArea, recordPresence } from '../geofence';
import { Area, mockAreas, mockUserAreas } from '../mocks/areas';
import { PresenceLog, mockPresenceLogs } from '../mocks/presenceLogs';
import { LatLng } from '../utils/geo';

// バックエンド未接続の段階では、GPSの代わりに「今どこにいることにするか」を
// ボタンで選ぶことで、ジオフェンス判定・PRESENCE_LOGS更新の動きを確認する。
const CURRENT_USER_ID = 'user-1';
const OUTSIDE_LOCATION: LatLng = { latitude: 0, longitude: 0 };

export default function GeofenceScreen() {
  const { colors } = useTheme();
  const monitoredAreaIds = mockUserAreas
    .filter((userArea) => userArea.user_id === CURRENT_USER_ID)
    .map((userArea) => userArea.area_id);
  const areas = mockAreas.filter((area) => monitoredAreaIds.includes(area.id));

  const [current, setCurrent] = useState<LatLng>(OUTSIDE_LOCATION);
  const [logs, setLogs] = useState<PresenceLog[]>(mockPresenceLogs);

  function simulateLocation(location: LatLng) {
    setCurrent(location);
    const now = new Date().toISOString();

    let updatedLogs = logs;
    for (const area of areas) {
      const inside = isInsideArea(location, area);
      updatedLogs = recordPresence(updatedLogs, CURRENT_USER_ID, area, inside, now);
    }
    setLogs(updatedLogs);
  }

  function isPresent(area: Area): boolean {
    return logs.some(
      (log) =>
        log.user_id === CURRENT_USER_ID &&
        log.area_id === area.id &&
        log.exited_at === null
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>ジオフェンス判定（モック）</Text>

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

      <View style={styles.buttons}>
        {areas.map((area) => (
          <Button
            key={area.id}
            label={`${area.name}にいることにする`}
            variant="secondary"
            onPress={() =>
              simulateLocation({ latitude: area.center_lat, longitude: area.center_lng })
            }
            style={styles.button}
          />
        ))}
        <Button
          label="エリア外にいることにする"
          onPress={() => simulateLocation(OUTSIDE_LOCATION)}
          style={styles.button}
        />
      </View>
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
  buttons: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    marginBottom: spacing.xs,
  },
});
