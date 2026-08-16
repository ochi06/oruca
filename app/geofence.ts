import { Area } from './mocks/areas';

type Coordinate = {
  lat: number;
  lng: number;
};

// TODO: US-018のapp/utils/geo.tsがmainにマージされたら、
// distanceInMeters(a, b) をそちらのimportに差し替える
function distanceInMeters(a: Coordinate, b: Coordinate): number {
  return 0; // 仮実装
}

export function isInsideArea(
  current: Coordinate,
  area: Area,
  calcDistance: (a: Coordinate, b: Coordinate) => number = distanceInMeters
): boolean {
  const distance = calcDistance(current, { lat: area.center_lat, lng: area.center_lng });
  return distance <= area.radius_m;
}
