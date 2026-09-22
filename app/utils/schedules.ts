// docs/schema.md「設計上の重要な原則」2.：友達の情報を見せてよいかどうかは、
// 必ず FRIEND_AREA_LINKS.status === 'approved' をチェックしてから判断すること。
// store/usePresenceStore.ts の resolveDisplayName と同じ考え方・同じ判定条件を、
// AREA_SCHEDULES / AREA_SCHEDULE_OVERRIDES にも適用する（US-011）。

import { FriendAreaLink } from '../mocks/presence';
import { AreaSchedule, AreaScheduleOverride } from '../mocks/schedules';

export type FriendSchedule = {
  userId: string;
  note: string | null; // 承認済みでなければ null（画面側で「非公開」表示）
  overrideNote: string | null; // 当日上書き予定。無ければnull
};

export function resolveFriendSchedule(
  currentUserId: string,
  friendId: string,
  areaId: string,
  date: string,
  friendAreaLinks: FriendAreaLink[],
  schedules: AreaSchedule[],
  overrides: AreaScheduleOverride[]
): FriendSchedule {
  const approvedLink = friendAreaLinks.find(
    (link) =>
      link.status === 'approved' &&
      link.area_id === areaId &&
      ((link.initiator_id === currentUserId && link.friend_id === friendId) ||
        (link.initiator_id === friendId && link.friend_id === currentUserId))
  );
  if (approvedLink === undefined) {
    return { userId: friendId, note: null, overrideNote: null };
  }

  const schedule = schedules.find((s) => s.user_id === friendId && s.area_id === areaId);
  const override = overrides.find(
    (o) => o.user_id === friendId && o.area_id === areaId && o.date === date
  );

  return {
    userId: friendId,
    note: schedule?.note ?? null,
    overrideNote: override?.note ?? null,
  };
}
