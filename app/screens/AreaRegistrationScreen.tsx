import { useRef, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, {
  Circle,
  Marker,
  MapMarker,
  MapPressEvent,
  MapStyleElement,
  MarkerDragStartEndEvent,
} from 'react-native-maps';
import Slider from '@react-native-community/slider';

import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { Area, mockAreas } from '../mocks/areas';
import { RADIUS_MIN_M, RADIUS_MAX_M } from '../constants/area';
import { darkMapStyle } from '../constants/mapStyle';
import {
  LatLng,
  bearingDegrees,
  destinationPoint,
  distanceInMeters,
} from '../lib/geo';

const INITIAL_HANDLE_BEARING_DEG = 90; // 初期状態のみ真東
const EMPTY_MAP_STYLE: MapStyleElement[] = [];

const defaultCenter: LatLng = {
  latitude: mockAreas[0].center_lat,
  longitude: mockAreas[0].center_lng,
};

function clampRadius(m: number): number {
  return Math.round(Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, m)));
}

type Props = {
  // ホーム画面統合時に、通常モードへ戻るための呼び出し元コールバック。
  // 単体動作確認の間は未指定でもよい。
  onClose?: () => void;
};

export default function AreaRegistrationScreen({ onClose }: Props) {
  const { colors, isDark } = useTheme();
  const [pin, setPin] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(RADIUS_MIN_M);
  const [handleBearingDeg, setHandleBearingDeg] = useState(
    INITIAL_HANDLE_BEARING_DEG
  );
  const handleMarkerRef = useRef<MapMarker>(null);
  const mapRef = useRef<MapView>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleMapPress = (event: MapPressEvent) => {
    setPin(event.nativeEvent.coordinate);
  };

  const searchResults = mockAreas.filter(
    (area) =>
      searchQuery.length > 0 && area.is_public && area.name.includes(searchQuery)
  );

  const openSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSelectArea = (area: Area) => {
    const center = { latitude: area.center_lat, longitude: area.center_lng };
    setPin(center);
    setRadiusM(area.radius_m);
    setHandleBearingDeg(INITIAL_HANDLE_BEARING_DEG);
    closeSearch();
    mapRef.current?.animateToRegion(
      { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  };

  const handleRegister = () => {
    if (!pin) return;
    // TODO: Supabaseへのinsert処理（US-018の🖊️タスク、バックエンド接続後に実装）
    console.log('register area (mock)', { pin, radiusM });
  };

  const handleHandleDrag = (event: MarkerDragStartEndEvent) => {
    if (!pin) return;
    const draggedTo = event.nativeEvent.coordinate;
    const clampedRadius = clampRadius(distanceInMeters(pin, draggedTo));
    const bearing = bearingDegrees(pin, draggedTo);

    setRadiusM(clampedRadius);
    setHandleBearingDeg(bearing);

    // ドラッグ中はネイティブ側が指の位置を優先してしまうため、
    // クランプ後の正しい位置に強制的に戻す
    handleMarkerRef.current?.setCoordinates(
      destinationPoint(pin, clampedRadius, bearing)
    );
  };

  const handlePosition = pin
    ? destinationPoint(pin, radiusM, handleBearingDeg)
    : null;

  return (
    <Screen style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          ...defaultCenter,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
        customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
      >
        {pin && <Marker coordinate={pin} pinColor={colors.navy} />}
        {pin && (
          <Circle
            center={pin}
            radius={radiusM}
            strokeColor={colors.blue}
            fillColor={`${colors.blue}33`}
          />
        )}
        {handlePosition && (
          <Marker
            ref={handleMarkerRef}
            coordinate={handlePosition}
            draggable
            onDrag={handleHandleDrag}
            onDragEnd={handleHandleDrag}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.handleDot, { backgroundColor: colors.sand }]} />
          </Marker>
        )}
      </MapView>
      {onClose && (
        <IconButton
          name="close-outline"
          variant="secondary"
          accessibilityLabel="エリア登録モードを閉じる"
          style={styles.closeModeButton}
          onPress={onClose}
        />
      )}
      {!isSearchOpen && (
        <IconButton
          name="search-outline"
          variant="secondary"
          accessibilityLabel="エリアを検索"
          style={styles.searchToggleButtonCollapsed}
          onPress={openSearch}
        />
      )}
      {isSearchOpen && (
        <View style={[styles.searchPanel, { backgroundColor: colors.surface }]}>
          <View style={styles.searchRow}>
            <TextInput
              style={[
                styles.searchInput,
                { borderColor: colors.textSub, color: colors.text },
              ]}
              placeholder="エリア名で検索"
              placeholderTextColor={colors.textSub}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <IconButton
              name="close-outline"
              variant="secondary"
              accessibilityLabel="検索を閉じる"
              style={styles.searchToggleButton}
              onPress={closeSearch}
            />
          </View>
          <FlatList
            style={styles.searchResultList}
            data={searchResults}
            keyExtractor={(area) => area.id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.searchResultRow, { borderBottomColor: colors.textSub }]}
                onPress={() => handleSelectArea(item)}
              >
                <Text style={{ color: colors.text }}>{item.name}</Text>
              </Pressable>
            )}
          />
        </View>
      )}
      {pin && (
        <View style={[styles.sliderContainer, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text }}>
            半径: {Math.round(radiusM)}m
          </Text>
          <Slider
            minimumValue={RADIUS_MIN_M}
            maximumValue={RADIUS_MAX_M}
            step={1}
            value={radiusM}
            onValueChange={setRadiusM}
          />
          <Button label="このエリアを登録する" onPress={handleRegister} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  sliderContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  closeModeButton: {
    position: 'absolute',
    top: 8,
    left: 16,
  },
  handleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  searchPanel: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    elevation: 3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
  },
  searchToggleButton: {
    padding: 8,
  },
  searchToggleButtonCollapsed: {
    position: 'absolute',
    top: 8,
    right: 16,
  },
  searchResultList: {
    maxHeight: 240,
    marginTop: 8,
  },
  searchResultRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});
