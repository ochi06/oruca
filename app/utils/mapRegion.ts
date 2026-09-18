export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const MIN_DELTA = 0.01; // 1エリアだけの場合でも狭くなりすぎないようにする下限
const PADDING_DEG = 0.01; // 全エリアの中心が収まるよう周囲に持たせる余白（簡易対応）
const FALLBACK_REGION: Region = {
  latitude: 34.7025,
  longitude: 135.4959,
  latitudeDelta: MIN_DELTA,
  longitudeDelta: MIN_DELTA,
};

// 複数エリアの中心座標がすべて収まる、大まかな地図の初期表示範囲を計算する。
// 半径やズームの正確なフィッティングまでは行わない簡易対応（Issue #62）
export function computeRegionForAreas(
  centers: { latitude: number; longitude: number }[]
): Region {
  if (centers.length === 0) {
    return FALLBACK_REGION;
  }

  const lats = centers.map((c) => c.latitude);
  const lngs = centers.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat + PADDING_DEG, MIN_DELTA),
    longitudeDelta: Math.max(maxLng - minLng + PADDING_DEG, MIN_DELTA),
  };
}
