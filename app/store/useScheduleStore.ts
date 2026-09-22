import { create } from 'zustand';

import { CURRENT_USER_ID, mockFriendAreaLinks, mockFriendships, mockUsers } from '../mocks/presence';
import {
  AreaSchedule,
  AreaScheduleOverride,
  mockAreaSchedules,
  mockAreaScheduleOverrides,
  TODAY,
} from '../mocks/schedules';
import { FriendSchedule, resolveFriendSchedule } from '../utils/schedules';

type ScheduleState = {
  schedules: AreaSchedule[];
  overrides: AreaScheduleOverride[];
  // 自分の基本滞在予定（無ければnull）
  myNote: (areaId: string) => string | null;
  // 自分の当日上書き予定（無ければnull）
  myOverrideNote: (areaId: string) => string | null;
  setMyNote: (areaId: string, note: string) => void;
  setMyOverrideNote: (areaId: string, note: string) => void;
  // 共通エリアを持つ友達（FRIENDSHIPS.status === 'active'）のうち、
  // このエリアで予定を見せ合うことに合意している（FRIEND_AREA_LINKS承認済み）人の予定一覧
  friendSchedules: (areaId: string) => FriendSchedule[];
  // 特定の友達1人分の予定（友達詳細画面での表示用）
  friendSchedule: (friendId: string, areaId: string) => FriendSchedule;
};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: mockAreaSchedules,
  overrides: mockAreaScheduleOverrides,

  myNote: (areaId) => {
    const schedule = get().schedules.find((s) => s.user_id === CURRENT_USER_ID && s.area_id === areaId);
    return schedule?.note ?? null;
  },

  myOverrideNote: (areaId) => {
    const override = get().overrides.find(
      (o) => o.user_id === CURRENT_USER_ID && o.area_id === areaId && o.date === TODAY
    );
    return override?.note ?? null;
  },

  setMyNote: (areaId, note) => {
    const { schedules } = get();
    const existing = schedules.find((s) => s.user_id === CURRENT_USER_ID && s.area_id === areaId);
    const now = new Date().toISOString();
    if (existing) {
      set({
        schedules: schedules.map((s) => (s.id === existing.id ? { ...s, note, updated_at: now } : s)),
      });
      return;
    }
    set({
      schedules: [
        ...schedules,
        {
          id: `schedule-${CURRENT_USER_ID}-${areaId}`,
          user_id: CURRENT_USER_ID,
          area_id: areaId,
          note,
          created_at: now,
          updated_at: now,
        },
      ],
    });
  },

  setMyOverrideNote: (areaId, note) => {
    const { overrides } = get();
    const existing = overrides.find(
      (o) => o.user_id === CURRENT_USER_ID && o.area_id === areaId && o.date === TODAY
    );
    const now = new Date().toISOString();
    if (existing) {
      set({
        overrides: overrides.map((o) => (o.id === existing.id ? { ...o, note, updated_at: now } : o)),
      });
      return;
    }
    set({
      overrides: [
        ...overrides,
        {
          id: `override-${CURRENT_USER_ID}-${areaId}-${TODAY}`,
          user_id: CURRENT_USER_ID,
          area_id: areaId,
          date: TODAY,
          note,
          created_at: now,
          updated_at: now,
        },
      ],
    });
  },

  friendSchedules: (areaId) => {
    const { schedules, overrides } = get();
    const friendIds = mockFriendships
      .filter((f) => f.user_id === CURRENT_USER_ID && f.status === 'active')
      .map((f) => f.friend_id);

    return friendIds.map((friendId) =>
      resolveFriendSchedule(
        CURRENT_USER_ID,
        friendId,
        areaId,
        TODAY,
        mockFriendAreaLinks,
        schedules,
        overrides
      )
    );
  },

  friendSchedule: (friendId, areaId) => {
    const { schedules, overrides } = get();
    return resolveFriendSchedule(
      CURRENT_USER_ID,
      friendId,
      areaId,
      TODAY,
      mockFriendAreaLinks,
      schedules,
      overrides
    );
  },
}));

// 表示名解決用。呼び出し側（画面）でuserIdからnameを引くために公開する
export function findUserName(userId: string): string {
  return mockUsers.find((user) => user.id === userId)?.name ?? '不明なユーザー';
}
