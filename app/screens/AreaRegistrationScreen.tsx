import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  MapMarker,
  MapPressEvent,
  MarkerDragStartEndEvent,
} from 'react-native-maps';
import Slider from '@react-native-community/slider';

import { mockAreas } from '../mocks/areas';
import { RADIUS_MIN_M, RADIUS_MAX_M } from '../constants/area';
import {
  LatLng,
  bearingDegrees,
  destinationPoint,
  distanceInMeters,
} from '../lib/geo';

const INITIAL_HANDLE_BEARING_DEG = 90; // 初期状態のみ真東

const defaultCenter: LatLng = mockAreas[0]
  ? { latitude: mockAreas[0].center_lat, longitude: mockAreas[0].center_lng }
  : { latitude: 34.6937, longitude: 135.5023 };

function clampRadius(m: number): number {
  return Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, m));
}

export default function AreaRegistrationScreen() {
  const [pin, setPin] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(RADIUS_MIN_M);
  const [handleBearingDeg, setHandleBearingDeg] = useState(
    INITIAL_HANDLE_BEARING_DEG
  );
  const handleMarkerRef = useRef<MapMarker>(null);

  const handleMapPress = (event: MapPressEvent) => {
    setPin(event.nativeEvent.coordinate);
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
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          ...defaultCenter,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
      >
        {pin && <Marker coordinate={pin} />}
        {pin && (
          <Circle
            center={pin}
            radius={radiusM}
            strokeColor="rgba(0, 122, 255, 0.8)"
            fillColor="rgba(0, 122, 255, 0.15)"
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
            <View style={styles.handleDot} />
          </Marker>
        )}
      </MapView>
      {pin && (
        <View style={styles.sliderContainer}>
          <Text>半径: {Math.round(radiusM)}m</Text>
          <Slider
            minimumValue={RADIUS_MIN_M}
            maximumValue={RADIUS_MAX_M}
            step={1}
            value={radiusM}
            onValueChange={setRadiusM}
          />
        </View>
      )}
    </View>
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
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
  },
  handleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'orange',
    borderWidth: 2,
    borderColor: 'white',
  },
});
