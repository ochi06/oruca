import { Area } from './mocks/areas';
import { LatLng, distanceInMeters } from './utils/geo';

export function isInsideArea(
  current: LatLng,
  area: Area,
  calcDistance: (a: LatLng, b: LatLng) => number = distanceInMeters
): boolean {
  const areaCenter: LatLng = { latitude: area.center_lat, longitude: area.center_lng };
  const distance = calcDistance(current, areaCenter);
  return distance <= area.radius_m;
}
