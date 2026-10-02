import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, MapPressEvent, MapStyleElement, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { darkMapStyle } from '../../constants/mapStyle';
import { userStatusIcon } from '../../constants/status';
import { ensureSignedIn } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Area } from '../../mocks/areas';
import { useGroupStore } from '../../store/useGroupStore';
import { matchesSearchQuery } from '../../utils/search';
import {
  AreaPresentUser,
  buildAreaPresentUsers,
  buildPresenceMarkers,
  PresenceLocation,
  PresenceMarker,
} from '../../utils/presenceMarkers';
import { computeRegionForAreas, Region } from '../../utils/mapRegion';
import { distanceInMeters } from '../../utils/geo';
import { MapStackParamList, RootTabParamList } from '../../navigation/types';
import { AreaPresencePopup } from './AreaPresencePopup';

const EMPTY_MAP_STYLE: MapStyleElement[] = [];

type LoadState = 'loading' | 'loaded' | 'error';

type PresenceMapData = {
  currentUserId: string;
  areas: Area[];
  markers: PresenceMarker[];
  // エリアID→そのエリアの在席者一覧（Issue #120のポップアップ・フルリスト用）
  areaPresence: Record<string, AreaPresentUser[]>;
  // エリアID→そのエリアの在席者マーカー（lat/lng付き）。1件のエリアに絞った表示
  // （Issue #261：友達/グループ一覧からの絞り込み・マップ内検索で共用）で使う
  markersByArea: Record<string, PresenceMarker[]>;
};

type SearchMode = 'area' | 'group';

type SearchResult = {
  id: string;
  name: string;
  areaId: string;
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
    .select('id, name, icon_url, status, is_anonymous, allow_entry_notifications, created_at, updated_at')
    .in('id', userIds.length > 0 ? userIds : ['']);
  if (usersError) throw usersError;

  // usersはRLS（FRIEND_AREA_LINKS.status='approved'の相手、または自分自身）で
  // 既に絞り込まれているため、ここではその結果をそのまま「表示してよい相手」として扱う。
  // ただし匿名モード中（is_anonymous）の相手は、自分自身でない限り除外する（US-013）
  const visibleUserIds = new Set(
    users?.filter((user) => user.id === currentUserId || !user.is_anonymous).map((user) => user.id) ?? []
  );

  const markers = buildPresenceMarkers(currentUserId, presenceLocations, visibleUserIds, users ?? []);

  const areaPresence: Record<string, AreaPresentUser[]> = {};
  // エリア1件に絞った表示（Issue #261）用に、エリアごとのマーカー（lat/lng付き）も
  // 同じループでまとめて作る。再フェッチせずクライアント側で絞り込めるようにするため
  const markersByArea: Record<string, PresenceMarker[]> = {};
  for (const areaId of areaIds) {
    const areaLocations = presenceLocations.filter((location) => location.area_id === areaId);
    const areaUserIds = Array.from(new Set(areaLocations.map((location) => location.user_id)));
    areaPresence[areaId] = buildAreaPresentUsers(currentUserId, areaUserIds, visibleUserIds, users ?? []);
    markersByArea[areaId] = buildPresenceMarkers(currentUserId, areaLocations, visibleUserIds, users ?? []);
  }

  return { currentUserId, areas: (areas ?? []) as Area[], markers, areaPresence, markersByArea };
}

// タブをまたいでネストしたStack Navigatorの画面（友達・グループタブのFriendDetail）へ
// 直接遷移できるように、MapStackとRootTabの両方のnavigation型を合成する
type MapScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<MapStackParamList, 'Map'>,
  BottomTabNavigationProp<RootTabParamList>
>;

type Props = NativeStackScreenProps<MapStackParamList, 'Map'> & {
  navigation: MapScreenNavigationProp;
};

export default function MapScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<PresenceMapData>({
    currentUserId: '',
    areas: [],
    markers: [],
    areaPresence: {},
    markersByArea: {},
  });
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  // 新規エリア登録画面に渡す現在の表示範囲（Issue #186）。stateにすると
  // 地図操作のたびに再レンダーが走ってしまうため、refで持つ
  const currentRegionRef = useRef<Region | null>(null);
  const mapRef = useRef<MapView>(null);

  // 友達・グループ一覧からの絞り込み遷移（route.params）、またはこの画面内の検索
  // （下のsearchQuery等）のどちらで設定された場合も、同じfilterAreaIdで
  // 「エリア1件に絞った表示」を共用する（Issue #261）。この画面はタブ内で使い回され、
  // 2回目以降のnavigateでもroute.paramsの変化を反映する必要があるため、
  // レンダー中にstateを更新する公式パターン（useEffectでの同期は避ける）を使う
  // （https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes）
  const [filterAreaId, setFilterAreaId] = useState<string | null>(route.params?.filterAreaId ?? null);
  const [prevRouteFilterAreaId, setPrevRouteFilterAreaId] = useState(route.params?.filterAreaId);
  if (route.params?.filterAreaId && route.params.filterAreaId !== prevRouteFilterAreaId) {
    setPrevRouteFilterAreaId(route.params.filterAreaId);
    setFilterAreaId(route.params.filterAreaId);
  }
  // 一覧からの遷移時のみ戻る矢印を出す（検索による絞り込みはこのタブ内で完結するため不要）
  const origin = route.params?.origin;

  const [searchMode, setSearchMode] = useState<SearchMode>('area');
  const [searchQuery, setSearchQuery] = useState('');
  const groups = useGroupStore((state) => state.groups);
  const groupStatus = useGroupStore((state) => state.status);
  const initializeGroups = useGroupStore((state) => state.initialize);

  // グループ名検索で使うグループ一覧は、友達・グループタブを先に開いていないと
  // 空のままになるため、ここでも遅延初期化する（hooks/useFriendUsers.tsと同じ方針）
  useEffect(() => {
    if (groupStatus === 'idle' && data.currentUserId) {
      initializeGroups(data.currentUserId);
    }
  }, [groupStatus, data.currentUserId, initializeGroups]);

  const searchResults: SearchResult[] = useMemo(() => {
    if (searchQuery.trim().length === 0) return [];
    if (searchMode === 'area') {
      return data.areas
        .filter((area) => matchesSearchQuery(area.name, searchQuery))
        .map((area) => ({ id: area.id, name: area.name, areaId: area.id }));
    }
    return groups
      .filter((group): group is typeof group & { area_id: string } => Boolean(group.area_id))
      .filter((group) => matchesSearchQuery(group.name, searchQuery))
      .map((group) => ({ id: group.id, name: group.name, areaId: group.area_id }));
  }, [searchQuery, searchMode, data.areas, groups]);

  function handleSelectSearchResult(result: SearchResult) {
    setFilterAreaId(result.areaId);
    setSearchQuery('');
  }

  // 検索欄を閉じる・絞り込み済みの状態から✕で戻る、のどちらも同じ「通常の
  // 全体マップ表示に戻る」操作として扱う（Issue #261）
  function handleClearFilter() {
    setFilterAreaId(null);
    setSearchQuery('');
  }

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

  // filterAreaIdが指すエリア1件に絞った表示（Issue #261）。見つからない場合
  // （未取得・対象外のエリア等）は通常の全エリア表示にフォールバックする
  const activeArea = filterAreaId ? data.areas.find((area) => area.id === filterAreaId) ?? null : null;
  const visibleAreas = activeArea ? [activeArea] : data.areas;
  const visibleMarkers = activeArea ? data.markersByArea[activeArea.id] ?? [] : data.markers;

  // 全エリア（または絞り込み時は対象1件）の中心が収まる大まかな表示範囲
  // （半径のフィッティングまでは行わない簡易対応）
  const region: Region = computeRegionForAreas(
    visibleAreas.map((area) => ({ latitude: area.center_lat, longitude: area.center_lng }))
  );

  // 絞り込み対象が変わるたび（絞り込み解除で全エリア表示に戻る場合も含む）、
  // 地図の表示範囲を追従させる
  useEffect(() => {
    mapRef.current?.animateToRegion(region, 400);
    // regionは毎レンダー新しいオブジェクトになるため、依存はactiveArea.idのみにする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArea?.id]);

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
        <EmptyState icon="map-outline" message="参加しているエリアがまだありません" />
        <Button label="新規エリア登録" onPress={() => navigation.navigate('AreaRegistration')} />
      </Screen>
    );
  }

  // react-native-mapsのCircleはタップイベントを持たないため、MapView全体のonPressで
  // タップ座標と各エリアの中心との距離を比較し、半径内に収まるエリアを選択する（Issue #120）
  const handleMapPress = (event: MapPressEvent) => {
    const tapped = event.nativeEvent.coordinate;
    const hitArea = visibleAreas.find(
      (area) =>
        distanceInMeters(tapped, { latitude: area.center_lat, longitude: area.center_lng }) <= area.radius_m
    );
    setSelectedArea(hitArea ?? null);
  };

  // アイコンをタップした相手の友達詳細画面へ、タブをまたいで遷移する（Issue #120フォローアップ）。
  // 承認されていない相手（displayNameがnull）・自分自身はタップしても何もしない
  const handleMarkerPress = (marker: PresenceMarker) => {
    if (!marker.displayName || marker.userId === data.currentUserId) return;
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('FriendsGroupsTab', {
      screen: 'FriendDetail',
      params: { friendId: marker.userId },
    });
  };

  return (
    <Screen style={styles.container} onBack={origin ? () => navigation.navigate('FriendsGroupsTab', { screen: 'FriendsGroupsList', params: { initialSegment: origin } }) : undefined}>
      {activeArea ? (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}>
          <Ionicons name="location-outline" size={18} color={colors.blue} />
          <Text style={[styles.filterChipLabel, { color: colors.text }]} numberOfLines={1}>
            {activeArea.name}
          </Text>
          <IconButton
            name="close-outline"
            variant="secondary"
            size={16}
            accessibilityLabel="絞り込みを解除"
            onPress={handleClearFilter}
          />
        </View>
      ) : (
        <View>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}>
            <View style={[styles.searchModeToggle, { borderColor: colors.lightblue }]}>
              <Pressable
                style={[styles.searchModeButton, searchMode === 'area' && { backgroundColor: colors.blue }]}
                onPress={() => setSearchMode('area')}
              >
                <Text style={[typography.caption, { color: searchMode === 'area' ? '#FFFFFF' : colors.text }]}>
                  エリア名
                </Text>
              </Pressable>
              <Pressable
                style={[styles.searchModeButton, searchMode === 'group' && { backgroundColor: colors.blue }]}
                onPress={() => setSearchMode('group')}
              >
                <Text style={[typography.caption, { color: searchMode === 'group' ? '#FFFFFF' : colors.text }]}>
                  グループ名
                </Text>
              </Pressable>
            </View>
            <Input
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchMode === 'area' ? 'エリア名で検索' : 'グループ名で検索'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <IconButton
                name="close-outline"
                variant="secondary"
                size={16}
                accessibilityLabel="検索を閉じる"
                onPress={handleClearFilter}
              />
            )}
          </View>
          {searchResults.length > 0 && (
            <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}>
              {searchResults.map((result) => (
                <Pressable
                  key={result.id}
                  style={styles.searchResultRow}
                  onPress={() => handleSelectSearchResult(result)}
                >
                  <Text style={[typography.body, { color: colors.text }]}>{result.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
        onPress={handleMapPress}
        onRegionChangeComplete={(nextRegion) => {
          currentRegionRef.current = nextRegion;
        }}
      >
        {visibleAreas.map((area) => (
          <Circle
            key={area.id}
            center={{ latitude: area.center_lat, longitude: area.center_lng }}
            radius={area.radius_m}
            strokeColor={colors.blue}
            fillColor={`${colors.blue}33`}
          />
        ))}
        {visibleMarkers.map((marker) => {
          const statusIcon = userStatusIcon(marker.status);
          return (
            <Marker
              key={marker.userId}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleMarkerPress(marker)}
            >
              {marker.displayName ? (
                <View style={styles.namedMarker}>
                  <Avatar name={marker.displayName} iconUrl={marker.iconUrl} size={32} />
                  {statusIcon && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.surface, borderColor: colors.blue }]}>
                      <Ionicons name={statusIcon} size={10} color={colors.blue} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.dotMarker, { backgroundColor: colors.textSub, borderColor: colors.surface }]} />
              )}
            </Marker>
          );
        })}
      </MapView>
      <View style={styles.mapActions}>
        <IconButton
          name="settings-outline"
          variant="secondary"
          accessibilityLabel="エリア管理"
          onPress={() => navigation.navigate('AreaManagement')}
        />
        <IconButton
          name="add-outline"
          accessibilityLabel="新規エリア登録"
          onPress={() =>
            navigation.navigate('AreaRegistration', {
              initialRegion: currentRegionRef.current ?? region,
            })
          }
        />
      </View>
      {selectedArea && (
        <AreaPresencePopup
          areaName={selectedArea.name}
          users={data.areaPresence[selectedArea.id] ?? []}
          onClose={() => setSelectedArea(null)}
          onSeeAll={() => {
            const users = data.areaPresence[selectedArea.id] ?? [];
            setSelectedArea(null);
            navigation.navigate('PresenceList', { areaName: selectedArea.name, users });
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  map: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  namedMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  mapActions: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchModeToggle: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  searchModeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
  },
  filterChipLabel: {
    ...typography.body,
    flex: 1,
  },
  searchDropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  searchResultRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
});
