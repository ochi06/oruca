import { computeRegionForAreas } from './mapRegion';

describe('computeRegionForAreas', () => {
  test('エリアが無い場合はフォールバックの座標を返す', () => {
    const region = computeRegionForAreas([]);
    expect(region.latitude).toBeCloseTo(34.7025);
    expect(region.longitude).toBeCloseTo(135.4959);
  });

  test('1エリアだけの場合は、その中心を返し最小幅を保つ', () => {
    const region = computeRegionForAreas([{ latitude: 35.0, longitude: 135.0 }]);
    expect(region.latitude).toBe(35.0);
    expect(region.longitude).toBe(135.0);
    expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.01);
    expect(region.longitudeDelta).toBeGreaterThanOrEqual(0.01);
  });

  test('複数エリアがある場合、すべての中心が収まる範囲を返す', () => {
    const region = computeRegionForAreas([
      { latitude: 34.7, longitude: 135.4 },
      { latitude: 34.8, longitude: 135.6 },
    ]);
    expect(region.latitude).toBeCloseTo(34.75);
    expect(region.longitude).toBeCloseTo(135.5);
    expect(region.latitudeDelta).toBeGreaterThan(0.1);
    expect(region.longitudeDelta).toBeGreaterThan(0.2);
  });
});
