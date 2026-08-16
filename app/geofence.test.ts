import { isInsideArea } from './geofence';
import { mockAreas } from './mocks/areas';

test('距離が半径以内ならエリア内と判定される', () => {
  const current = { lat: 0, lng: 0 };
  const area = mockAreas[0]; // radius_m: 30

  const result = isInsideArea(current, area, () => 20);

  expect(result).toBe(true);
});

test('距離が半径ちょうどの時ならエリア内', () => {
  const current = { lat: 0, lng: 0};
  const area = mockAreas[0];

  const result = isInsideArea(current , area, () => 30);

  expect(result).toBe(true);
})

test('距離が半径よりも大きい時ならエリア外', () => {
  const current = { lat: 0, lng: 0};
  const area = mockAreas[0];

  const result = isInsideArea(current , area, () => 50);

  expect(result).toBe(false);
})