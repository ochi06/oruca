import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, MapStyleElement, Marker } from 'react-native-maps';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { darkMapStyle } from '../../constants/mapStyle';
import { ensureSignedIn } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Area } from '../../mocks/areas';
import { buildPresenceMarkers, PresenceLocation, PresenceMarker } from '../../store/usePresenceStore';
import { computeRegionForAreas, Region } from '../../utils/mapRegion';
import { MapStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const EMPTY_MAP_STYLE: MapStyleElement[] = [];

type LoadState = 'loading' | 'loaded' | 'error';

type PresenceMapData = {
  areas: Area[];
  markers: PresenceMarker[];
};

// 自分が参加している全エリア（USER_AREAS）と、その中の在席者をまとめて取得する（Issue #62）
async function fetchPresenceMapData(): Promise<PresenceMapData> {
  const currentUserId = await ensureSignedIn();

  const { data: userAreas, error: userAreasError } = await supabase
    .from('user_areas')
    .select('area_id')
    .eq('user_id', currentUserId);
  if (userAreasError) throw userAreasError;

  const areaIds = Array.from(new Set((userAreas ?? []).map((row) => row.area_id)));
  if (areaIds.length === 0) {
    return { areas: [], markers: [] };
  }

  const { data: areas, error: areasError } = await supabase
    .from('areas')
    .select('id, owner_user_id, name, center_lat, center_lng, radius_m, is_public, created_at, updated_at')
    .in('id', areaIds);
  if (areasError) throw areasError;

  const { data: locations, error: presenceError } = await supabase
    .from('presence_logs')
    .select('user_id, lat, lng')
    .in('area_id', areaIds)
    .is('exited_at', null);
  if (presenceError) throw presenceError;

  const presenceLocations = (locations ?? []) as PresenceLocation[];
  const userIds = Array.from(new Set(presenceLocations.map((location) => location.user_id)));

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, icon_url, status, is_anonymous, created_at, updated_at')
    .in('id', userIds.length > 0 ? userIds : ['']);
  if (usersError) throw usersError;

  // usersはRLS（FRIEND_AREA_LINKS.status='approved'の相手、または自分自身）で
  // 既に絞り込まれているため、ここではその結果をそのまま「表示してよい相手」として扱う。
  // ただし匿名モード中（is_anonymous）の相手は、自分自身でない限り除外する（US-013）
  const visibleUserIds = new Set(
    users?.filter((user) => user.id === currentUserId || !user.is_anonymous).map((user) => user.id) ?? []
  );

  const markers = buildPresenceMarkers(currentUserId, presenceLocations, visibleUserIds, users ?? []);

  return { areas: (areas ?? []) as Area[], markers };
}

type Props = NativeStackScreenProps<MapStackParamList, 'Map'>;

export default function MapScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PresenceMapData>({ areas: [], markers: [] });

  const load = useCallback(() => {
    setState('loading');
    fetchPresenceMapData()
      .then((result) => {
        setData(result);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // 新規エリア登録・エリア管理（編集・削除）から戻ってきた際に地図を最新化する
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

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
        <ErrorState message="エリア・在席者の取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  if (data.areas.length === 0) {
    return (
      <Screen style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>マップ</Text>
        <EmptyState icon="map-outline" message="参加しているエリアがまだありません" />
        <Button label="新規エリア登録" onPress={() => navigation.navigate('AreaRegistration')} />
      </Screen>
    );
  }

  // 全エリアの中心が収まる大まかな表示範囲（半径のフィッティングまでは行わない簡易対応）
  const region: Region = computeRegionForAreas(
    data.areas.map((area) => ({ latitude: area.center_lat, longitude: area.center_lng }))
  );

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>マップ</Text>
      <MapView
        style={styles.map}
        initialRegion={region}
        customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
      >
        {data.areas.map((area) => (
          <Circle
            key={area.id}
            center={{ latitude: area.center_lat, longitude: area.center_lng }}
            radius={area.radius_m}
            strokeColor={colors.blue}
            fillColor={`${colors.blue}33`}
          />
        ))}
        {data.markers.map((marker) => (
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
      <IconButton
        name="settings-outline"
        variant="secondary"
        accessibilityLabel="エリア管理"
        style={styles.manageAreaButton}
        onPress={() => navigation.navigate('AreaManagement')}
      />
      <IconButton
        name="add-outline"
        accessibilityLabel="新規エリア登録"
        style={styles.addAreaButton}
        onPress={() => navigation.navigate('AreaRegistration')}
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
  addAreaButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
  manageAreaButton: {
    position: 'absolute',
    bottom: 24,
    right: 64,
  },
});
