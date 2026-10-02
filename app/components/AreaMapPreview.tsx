import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import MapView, { Circle, MapStyleElement, Marker } from 'react-native-maps';

import { useTheme } from '../theme/useTheme';
import { radius } from '../theme/spacing';
import { darkMapStyle } from '../constants/mapStyle';

const EMPTY_MAP_STYLE: MapStyleElement[] = [];

type Props = {
  centerLat: number;
  centerLng: number;
  radiusM: number;
  style?: StyleProp<ViewStyle>;
};

// 未監視のエリアへの紐づけ提案を、名前だけでなく地図上の位置・範囲で
// 確認した上で承認・拒否できるようにするための読み取り専用プレビュー
// （Issue #340）。AreaEditScreen.tsxのMapView/Circleと同じ見た目だが、
// 操作（ピン移動・半径ドラッグ）は一切行わせない
export function AreaMapPreview({ centerLat, centerLng, radiusM, style }: Props) {
  const { colors, isDark } = useTheme();
  const center = { latitude: centerLat, longitude: centerLng };

  return (
    <MapView
      style={[styles.map, style]}
      initialRegion={{
        ...center,
        // 半径が見切れないよう、半径の指標的な見た目を確保する大まかな値
        // （AreaRegistrationScreen等の編集画面ほどの精度は不要）
        latitudeDelta: Math.max(0.01, (radiusM / 50000) * 2),
        longitudeDelta: Math.max(0.01, (radiusM / 50000) * 2),
      }}
      customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      <Marker coordinate={center} pinColor={colors.navy} />
      <Circle center={center} radius={radiusM} strokeColor={colors.blue} fillColor={`${colors.blue}33`} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 120,
    borderRadius: radius.sm,
  },
});
