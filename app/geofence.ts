import { Area } from './mocks/areas';
import { PresenceLog } from './mocks/presenceLogs';
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

export function recordPresence(
  logs: PresenceLog[],
  userId: string,
  area: Area,
  isInside: boolean,
  now: string
): PresenceLog[] {
  const openLog = logs.find(
    (log) => log.user_id === userId && log.area_id === area.id && log.exited_at === null
  );

  if (isInside && !openLog) {
    // エリア内 かつ 入室中ログがまだない → 新規入室として追加
    const newLog: PresenceLog = {
      id: `log-${logs.length + 1}`,
      user_id: userId,
      area_id: area.id,
      entered_at: now,
      exited_at: null,
    };
    return [...logs, newLog];
  }

  if (!isInside && openLog) {
    // エリア外 かつ 入室中ログがある → 退室として更新
    return logs.map((log) =>
      log.id === openLog.id ? { ...log, exited_at: now } : log
    );
  }

  // それ以外（エリア内で既に入室中 / エリア外でもともと入室していない）は変化なし
  return logs;
}
