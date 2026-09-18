import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, MapStyleElement, Marker } from 'react-native-maps';

import { Avatar } from '../components/Avatar';
import { ErrorState } from '../components/ErrorState';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { darkMapStyle } from '../constants/mapStyle';
import { ensureSignedIn } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { mockAreas } from '../mocks/areas';
import { buildPresenceMarkers, PresenceLocation, PresenceMarker } from '../store/usePresenceStore';

const EMPTY_MAP_STYLE: MapStyleElement[] = [];

// GeofenceScreen.tsxのBACKEND_AREA_IDSと同じ対応（デモ用に事前投入済みの
// エリアは1件のみ）。エリア登録機能（US-018）と繋がった後は、実エリアの
// 中心・半径をSupabaseから取得する形に置き換える想定
const DEMO_AREA_ID = 'c06fe2ac-fff3-42a8-b5ea-00756b9396e4';
const demoArea = mockAreas.find((area) => area.id === 'area-1')!;

type LoadState = 'loading' | 'loaded' | 'error';

async function fetchPresenceMarkers(areaId: string): Promise<PresenceMarker[]> {
  const currentUserId = await ensureSignedIn();

  const { data: locations, error: presenceError } = await supabase
    .from('presence_logs')
    .select('user_id, lat, lng')
    .eq('area_id', areaId)
    .is('exited_at', null);
  if (presenceError) throw presenceError;

  const presenceLocations = (locations ?? []) as PresenceLocation[];
  const userIds = Array.from(new Set(presenceLocations.map((location) => location.user_id)));

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, icon_url, created_at, updated_at')
    .in('id', userIds.length > 0 ? userIds : ['']);
  if (usersError) throw usersError;

  // DEMO SHORTCUT (ADR-0008): 本来はFRIEND_AREA_LINKS承認が必要。
  // 今夜のデモに限り、同じエリアに在席している（=presence_logsに行がある）
  // ユーザーは全員、承認状態に関わらず名前・アイコンつきで表示する
  const visibleUserIds = new Set(userIds);

  return buildPresenceMarkers(currentUserId, presenceLocations, visibleUserIds, users ?? []);
}

export default function PresenceMapScreen() {
  const { colors, isDark } = useTheme();
  const [state, setState] = useState<LoadState>('loading');
  const [markers, setMarkers] = useState<PresenceMarker[]>([]);

  const load = useCallback(() => {
    setState('loading');
    fetchPresenceMarkers(DEMO_AREA_ID)
      .then((result) => {
        setMarkers(result);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen style={styles.container}>
        <ErrorState message="在席者の取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>マップ</Text>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: demoArea.center_lat,
          longitude: demoArea.center_lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
      >
        <Circle
          center={{ latitude: demoArea.center_lat, longitude: demoArea.center_lng }}
          radius={demoArea.radius_m}
          strokeColor={colors.blue}
          fillColor={`${colors.blue}33`}
        />
        {markers.map((marker) => (
          <Marker
            key={marker.userId}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {marker.displayName ? (
              <View style={styles.namedMarker}>
                <Avatar name={marker.displayName} iconUrl={marker.iconUrl} size={32} />
                <Text style={[styles.markerLabel, { color: colors.text, backgroundColor: colors.surface }]}>
                  {marker.displayName}
                </Text>
              </View>
            ) : (
              <View style={[styles.dotMarker, { backgroundColor: colors.textSub, borderColor: colors.surface }]} />
            )}
          </Marker>
        ))}
      </MapView>
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
  map: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  namedMarker: {
    alignItems: 'center',
  },
  markerLabel: {
    ...typography.caption,
    marginTop: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dotMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
});
