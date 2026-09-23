import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  MapMarker,
  MapPressEvent,
  MapStyleElement,
  MarkerDragStartEndEvent,
} from 'react-native-maps';
import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { darkMapStyle } from '../../constants/mapStyle';
import { RADIUS_MIN_M, RADIUS_MAX_M } from '../../constants/area';
import { updateArea } from '../../lib/areas';
import {
  LatLng,
  bearingDegrees,
  destinationPoint,
  distanceInMeters,
} from '../../utils/geo';
import { MapStackParamList } from '../../navigation/types';

const INITIAL_HANDLE_BEARING_DEG = 90; // 初期状態のみ真東
const EMPTY_MAP_STYLE: MapStyleElement[] = [];

function clampRadius(m: number): number {
  return Math.round(Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, m)));
}

type Props = NativeStackScreenProps<MapStackParamList, 'AreaEdit'>;

export default function AreaEditScreen({ route, navigation }: Props) {
  const { area } = route.params;
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState(area.name);
  const [pin, setPin] = useState<LatLng>({
    latitude: area.center_lat,
    longitude: area.center_lng,
  });
  const [radiusM, setRadiusM] = useState(area.radius_m);
  const [handleBearingDeg, setHandleBearingDeg] = useState(INITIAL_HANDLE_BEARING_DEG);
  const [saving, setSaving] = useState(false);
  const handleMarkerRef = useRef<MapMarker>(null);

  const handleMapPress = (event: MapPressEvent) => {
    setPin(event.nativeEvent.coordinate);
    setHandleBearingDeg(INITIAL_HANDLE_BEARING_DEG);
  };

  const handleHandleDrag = (event: MarkerDragStartEndEvent) => {
    const draggedTo = event.nativeEvent.coordinate;
    const clampedRadius = clampRadius(distanceInMeters(pin, draggedTo));
    const bearing = bearingDegrees(pin, draggedTo);

    setRadiusM(clampedRadius);
    setHandleBearingDeg(bearing);

    // ドラッグ中はネイティブ側が指の位置を優先してしまうため、
    // クランプ後の正しい位置に強制的に戻す
    handleMarkerRef.current?.setCoordinates(destinationPoint(pin, clampedRadius, bearing));
  };

  const handlePosition = destinationPoint(pin, radiusM, handleBearingDeg);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('エリア名を入力してください');
      return;
    }
    setSaving(true);
    try {
      await updateArea(area.id, {
        name: trimmedName,
        center_lat: pin.latitude,
        center_lng: pin.longitude,
        radius_m: radiusM,
      });
      showToast(`「${trimmedName}」を更新しました`);
      navigation.goBack();
    } catch {
      showToast('エリアの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: pin.latitude,
          longitude: pin.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
        customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
      >
        <Marker coordinate={pin} pinColor={colors.navy} />
        <Circle
          center={pin}
          radius={radiusM}
          strokeColor={colors.blue}
          fillColor={`${colors.blue}33`}
        />
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
      </MapView>
      <IconButton
        name="close-outline"
        variant="secondary"
        accessibilityLabel="編集をやめる"
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
        disabled={saving}
      />
      <View style={[styles.editPanel, { backgroundColor: colors.surface }]}>
        <Input value={name} onChangeText={setName} placeholder="エリア名（例：部室）" />
        <Text style={{ color: colors.text }}>半径: {Math.round(radiusM)}m</Text>
        <Slider
          minimumValue={RADIUS_MIN_M}
          maximumValue={RADIUS_MAX_M}
          step={1}
          value={radiusM}
          onValueChange={setRadiusM}
        />
        <Button label={saving ? '保存中…' : '保存する'} onPress={handleSave} disabled={saving} />
      </View>
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
  closeButton: {
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
  editPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
});
