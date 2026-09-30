// docs/schema.md「設計上の重要な原則」2.：友達の情報を見せてよいかどうかは、
// 必ず FRIEND_AREA_LINKS.status === 'approved' をチェックしてから判断すること。
// この考え方・判定条件を AREA_SCHEDULES / AREA_SCHEDULE_OVERRIDES にも適用する（US-011）。
// Issue #159でSupabase接続する際、area_schedules/area_schedule_overrides
// テーブル自体のRLSでも同じ条件（承認済みFRIEND_AREA_LINKS）を強制しているため
// 二重の防御になっているが、クライアント側の可視性判定ロジックとしても
// 引き続きこの関数を使う（テストしやすさ・presence側と同じ方針を踏襲）

import { FriendAreaLink } from '../mocks/presence';

export type AreaSchedule = {
  id: string;
  user_id: string;
  area_id: string;
  note: string;
  created_at: string;
  updated_at: string;
};

export type AreaScheduleOverride = {
  id: string;
  user_id: string;
  area_id: string;
  date: string; // YYYY-MM-DD
  note: string;
  created_at: string;
  updated_at: string;
};

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
