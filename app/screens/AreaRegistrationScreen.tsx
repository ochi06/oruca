import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';

import { mockAreas } from '../mocks/areas';

type LatLng = {
  latitude: number;
  longitude: number;
};

const defaultCenter: LatLng = mockAreas[0]
  ? { latitude: mockAreas[0].center_lat, longitude: mockAreas[0].center_lng }
  : { latitude: 34.6937, longitude: 135.5023 };

export default function AreaRegistrationScreen() {
  const [pin, setPin] = useState<LatLng | null>(null);

  const handleMapPress = (event: MapPressEvent) => {
    setPin(event.nativeEvent.coordinate);
  };

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
      </MapView>
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
});
