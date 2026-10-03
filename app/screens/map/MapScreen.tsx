import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Circle, MapPressEvent, MapStyleElement, Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { BACK_BUTTON_RESERVED_HEIGHT, Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { darkMapStyle } from '../../constants/mapStyle';
import { userStatusIcon } from '../../constants/status';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { Area } from '../../mocks/areas';
import { useGroupStore } from '../../store/useGroupStore';
import { usePresenceStore } from '../../store/usePresenceStore';
import { matchesSearchQuery } from '../../utils/search';
import { PresenceMarker } from '../../utils/presenceMarkers';
import { computeRegionForAreas, Region } from '../../utils/mapRegion';
import { distanceInMeters } from '../../utils/geo';
import { MapStackParamList, RootTabParamList } from '../../navigation/types';
import { AreaPresencePopup } from './AreaPresencePopup';

const EMPTY_MAP_STYLE: MapStyleElement[] = [];

type SearchMode = 'area' | 'group';

type SearchResult = {
  id: string;
  name: string;
  areaId: string;
};

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
  const insets = useSafeAreaInsets();
  // Issue #397: insets.bottom（セーフエリアのみ）はタブバー自体の高さを
  // 含まないため、機種・画面サイズによってタブバーの上に余計な隙間ができたり
  // 足りなかったりしていた。実際のタブバー高さ（セーフエリア込み）を基準にする
  const tabBarHeight = useBottomTabBarHeight();
  const presenceStatus = usePresenceStore((s) => s.status);
  const data = usePresenceStore(
    useShallow((s) => ({
      currentUserId: s.currentUserId,
      areas: s.areas,
      markers: s.markers,
      areaPresence: s.areaPresence,
      markersByArea: s.markersByArea,
    }))
  );
  const loadPresence = usePresenceStore((s) => s.load);
  // 初回取得が終わるまではidle/loadingのどちらも「読み込み中」として扱う
  const state = presenceStatus === 'idle' ? 'loading' : presenceStatus;
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
  // （https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes）。
  // route.paramsの参照そのものをトラッキングし、filterAreaIdが無くなった場合
  // （Issue #280：タブを直接タップして戻った場合のparamsクリア）も含めて同期する
  const [filterAreaId, setFilterAreaId] = useState<string | null>(route.params?.filterAreaId ?? null);
  const [prevRouteParams, setPrevRouteParams] = useState(route.params);
  if (route.params !== prevRouteParams) {
    setPrevRouteParams(route.params);
    setFilterAreaId(route.params?.filterAreaId ?? null);
  }
  // 一覧からの遷移時のみ戻る矢印を出す（検索による絞り込みはこのタブ内で完結するため不要）
  const origin = route.params?.origin;

  // 検索欄は通常時アイコンのみ表示し、タップで展開する（Issue #279）
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('area');
  const [searchQuery, setSearchQuery] = useState('');
  // 絞り込み済みのエリア名タップで、他の登録エリアへ切り替えるプルダウン（Issue #285）
  const [areaSwitcherOpen, setAreaSwitcherOpen] = useState(false);
  const groups = useGroupStore((state) => state.groups);
  const groupStatus = useGroupStore((state) => state.status);
  const initializeGroups = useGroupStore((state) => state.initialize);
  // Issue #278：AreaPresencePopupでアイコンタップ遷移を友達のみに限定するための判定に使う
  const friends = useFriendUsers();
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);

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
    loadPresence();
  }, [loadPresence]);

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

  // 地図を画面いっぱいに敷くため（Issue #275）、戻るボタン・検索欄・浮動
  // ボタンはすべてセーフエリアに重ならない位置の絶対配置オーバーレイにする。
  // 戻るボタンが出る場合（origin指定時）は、Screen側が確保する分と同じ高さを
  // 検索欄側でも空けて重なりを避ける
  const overlayTop = insets.top + spacing.sm + (origin ? BACK_BUTTON_RESERVED_HEIGHT : 0);

  // AreaPresencePopupの在席者アイコンタップ（Issue #278）。友達かどうかは
  // 呼び出し側（AreaPresencePopup）でfriendIdsを見て判定済みのため、ここでは
  // そのまま遷移するだけでよい
  const handlePressPresenceUser = (userId: string) => {
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate('FriendsGroupsTab', {
      screen: 'FriendDetail',
      params: { friendId: userId },
    });
  };

  return (
    <Screen style={styles.mapContainer} disableSafeAreaPadding onBack={origin ? () => navigation.navigate('FriendsGroupsTab', { screen: 'FriendsGroupsList', params: { initialSegment: origin } }) : undefined}>
      <View style={[styles.searchOverlay, { top: overlayTop }]}>
        <View style={styles.headerRow}>
          {activeArea ? (
            <Pressable
              style={[styles.areaNameButton, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}
              onPress={() => setAreaSwitcherOpen((v) => !v)}
            >
              <Ionicons name="location-outline" size={18} color={colors.blue} />
              <Text style={[styles.filterChipLabel, { color: colors.text }]} numberOfLines={1}>
                {activeArea.name}
              </Text>
              {data.areas.length > 1 && (
                <Ionicons name="chevron-down-outline" size={16} color={colors.textSub} />
              )}
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          {!searchOpen && (
            <IconButton
              name="search-outline"
              variant="secondary"
              accessibilityLabel="検索"
              onPress={() => setSearchOpen(true)}
            />
          )}
          {activeArea && !origin && (
            <IconButton
              name="close-outline"
              variant="ghost"
              size={20}
              accessibilityLabel="絞り込みを解除"
              onPress={handleClearFilter}
            />
          )}
        </View>

        {areaSwitcherOpen && activeArea && data.areas.length > 1 && (
          <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}>
            {data.areas
              .filter((area) => area.id !== activeArea.id)
              .map((area) => (
                <Pressable
                  key={area.id}
                  style={styles.searchResultRow}
                  onPress={() => {
                    setFilterAreaId(area.id);
                    setAreaSwitcherOpen(false);
                  }}
                >
                  <Text style={[typography.body, { color: colors.text }]}>{area.name}</Text>
                </Pressable>
              ))}
          </View>
        )}

        {searchOpen && (
          <View>
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}>
              <SegmentedControl
                size="sm"
                fillWidth={false}
                options={[
                  { value: 'area', label: 'エリア名' },
                  { value: 'group', label: 'グループ名' },
                ]}
                value={searchMode}
                onChange={setSearchMode}
              />
              <Input
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={searchMode === 'area' ? 'エリア名で検索' : 'グループ名で検索'}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <IconButton
                name="close-outline"
                variant="ghost"
                size={20}
                accessibilityLabel="検索を閉じる"
                onPress={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
              />
            </View>
            {searchResults.length > 0 && (
              <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.lightblue }]}>
                {searchResults.map((result) => (
                  <Pressable
                    key={result.id}
                    style={styles.searchResultRow}
                    onPress={() => {
                      handleSelectSearchResult(result);
                      setSearchOpen(false);
                    }}
                  >
                    <Text style={[typography.body, { color: colors.text }]}>{result.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
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
      <View style={[styles.mapActions, { bottom: tabBarHeight + spacing.sm }]}>
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
          friendIds={friendIds}
          onClose={() => setSelectedArea(null)}
          onSeeAll={() => {
            const areaId = selectedArea.id;
            setSelectedArea(null);
            navigation.navigate('PresenceList', { areaName: selectedArea.name, areaId });
          }}
          onPressUser={handlePressPresenceUser}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 1,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerSpacer: {
    flex: 1,
  },
  areaNameButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
