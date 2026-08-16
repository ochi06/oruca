import { isInsideArea, recordPresence } from './geofence';
import { mockAreas } from './mocks/areas';
import { PresenceLog } from './mocks/presenceLogs';

test('距離が半径以内ならエリア内と判定される', () => {
  const current = { latitude: 0, longitude: 0 };
  const area = mockAreas[0]; // radius_m: 30

  const result = isInsideArea(current, area, () => 20);

  expect(result).toBe(true);
});

test('距離が半径ちょうどの時ならエリア内', () => {
  const current = { latitude: 0, longitude: 0 };
  const area = mockAreas[0];

  const result = isInsideArea(current, area, () => 30);

  expect(result).toBe(true);
})

test('距離が半径よりも大きい時ならエリア外', () => {
  const current = { latitude: 0, longitude: 0 };
  const area = mockAreas[0];

  const result = isInsideArea(current, area, () => 50);

  expect(result).toBe(false);
})

test('エリア内かつ入室中ログがない場合、新規ログが追加される', () => {
  const logs: PresenceLog[] = []; // 入室中ログなし
  const userId = 'user-1';
  const area = mockAreas[0]; // area-1
  const isInside = true;
  const now = '2026-08-16T10:00:00.000Z';

  // ここから続きを書いてください（recordPresenceを呼び出し、resultを検証する）

  const result = recordPresence(logs, userId, area, isInside, now);

  expect(result).toEqual([{id:'log-1',user_id: userId, area_id: area.id, entered_at: now, exited_at: null}]);
  })

test('エリア内かつ既に入室中ログがある場合、変化なし', () => {
  const userId = 'user-1';
  const area = mockAreas[0]; // area-1
  const isInside = true;
  const now = '2026-08-16T10:00:00.000Z';
  const logs: PresenceLog[] = [
    { id: 'log-1', user_id: userId, area_id: area.id, entered_at: '2026-08-16T09:00:00.000Z', exited_at: null },
  ];

  const result = recordPresence(logs, userId, area, isInside, now);

  expect(result).toEqual(logs);
})

test('エリア外かつ入室中ログがある場合、退室として更新される', () => {
  const userId = 'user-1';
  const area = mockAreas[0]; // area-1
  const isInside = false;
  const now = '2026-08-16T18:00:00.000Z';
  const logs: PresenceLog[] = [
    { id: 'log-1', user_id: userId, area_id: area.id, entered_at: '2026-08-16T09:00:00.000Z', exited_at: null },
  ];

  const result = recordPresence(logs, userId, area, isInside, now);

  expect(result).toEqual([
    { id: 'log-1', user_id: userId, area_id: area.id, entered_at: '2026-08-16T09:00:00.000Z', exited_at: now },
  ]);
})

test('エリア外かつ入室中ログがない場合、変化なし', () => {
  const userId = 'user-1';
  const area = mockAreas[0]; // area-1
  const isInside = false;
  const now = '2026-08-16T18:00:00.000Z';
  const logs: PresenceLog[] = [];

  const result = recordPresence(logs, userId, area, isInside, now);

  expect(result).toEqual(logs);
})