import { create } from 'zustand';

import { ensureSignedIn } from '../lib/auth';
import {
  fetchAreaSchedules,
  fetchAreaScheduleOverrides,
  fetchFriendAreaLinks,
  upsertMySchedule,
  upsertMyScheduleOverride,
} from '../lib/schedules';
import { fetchFriendships } from '../lib/friends';
import { FriendAreaLink } from '../mocks/presence';
import { AreaSchedule, AreaScheduleOverride, FriendSchedule, resolveFriendSchedule } from '../utils/schedules';
import { todayDateString } from '../utils/format';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// Issue #159 (US-011)：AREA_SCHEDULES/AREA_SCHEDULE_OVERRIDESを実Supabaseに
// 接続する。UIは「1画面が1エリア分の予定を表示する」という使い方のみのため、
// 直近にinitialize()したエリア1件分だけをキャッシュする（同時に複数エリアを
// 表示する画面は現状無い）
type ScheduleState = {
  areaId: string | null;
  currentUserId: string | null;
  status: LoadStatus;
  errorMessage: string | null;
  schedules: AreaSchedule[];
  overrides: AreaScheduleOverride[];
  friendAreaLinks: FriendAreaLink[];
  friendIds: string[];
  // areaIdの予定データを取得する。既に同じエリアを読み込み済み
  // （またはロード中）なら何もしない
  initialize: (areaId: string) => Promise<void>;
  // 自分の基本滞在予定（無ければnull）
  myNote: (areaId: string) => string | null;
  // 自分の当日上書き予定（無ければnull）
  myOverrideNote: (areaId: string) => string | null;
  setMyNote: (areaId: string, note: string) => Promise<void>;
  setMyOverrideNote: (areaId: string, note: string) => Promise<void>;
  // 共通エリアを持つ友達（FRIENDSHIPS.status === 'active'）のうち、
  // このエリアで予定を見せ合うことに合意している（FRIEND_AREA_LINKS承認済み）人の予定一覧
  friendSchedules: (areaId: string) => FriendSchedule[];
  // 特定の友達1人分の予定（友達詳細画面での表示用）
  friendSchedule: (friendId: string, areaId: string) => FriendSchedule;
};

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  areaId: null,
  currentUserId: null,
  status: 'idle',
  errorMessage: null,
  schedules: [],
  overrides: [],
  friendAreaLinks: [],
  friendIds: [],

  initialize: async (areaId) => {
    const state = get();
    if (state.areaId === areaId && (state.status === 'loading' || state.status === 'ready')) {
      return;
    }
    set({ status: 'loading', errorMessage: null, areaId });
    try {
      const currentUserId = await ensureSignedIn();
      const today = todayDateString(new Date());
      const [schedules, overrides, friendAreaLinks, friendships] = await Promise.all([
        fetchAreaSchedules(areaId),
        fetchAreaScheduleOverrides(areaId, today),
        fetchFriendAreaLinks(areaId),
        fetchFriendships(currentUserId),
      ]);
      set({
        currentUserId,
        schedules,
        overrides,
        friendAreaLinks,
        friendIds: friendships.map((f) => f.friend_id),
        status: 'ready',
      });
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '滞在予定の取得に失敗しました',
      });
    }
  },

  myNote: (areaId) => {
    const { schedules, currentUserId } = get();
    const schedule = schedules.find((s) => s.user_id === currentUserId && s.area_id === areaId);
    return schedule?.note ?? null;
  },

  myOverrideNote: (areaId) => {
    const { overrides, currentUserId } = get();
    const today = todayDateString(new Date());
    const override = overrides.find(
      (o) => o.user_id === currentUserId && o.area_id === areaId && o.date === today
    );
    return override?.note ?? null;
  },

  setMyNote: async (areaId, note) => {
    const { currentUserId, schedules } = get();
    if (!currentUserId) return;

    await upsertMySchedule(currentUserId, areaId, note);
    const nowIso = new Date().toISOString();
    const existing = schedules.find((s) => s.user_id === currentUserId && s.area_id === areaId);
    set({
      schedules: existing
        ? schedules.map((s) => (s.id === existing.id ? { ...s, note, updated_at: nowIso } : s))
        : [
            ...schedules,
            {
              id: `local-${currentUserId}-${areaId}`,
              user_id: currentUserId,
              area_id: areaId,
              note,
              created_at: nowIso,
              updated_at: nowIso,
            },
          ],
    });
  },

  setMyOverrideNote: async (areaId, note) => {
    const { currentUserId, overrides } = get();
    if (!currentUserId) return;

    const today = todayDateString(new Date());
    await upsertMyScheduleOverride(currentUserId, areaId, today, note);
    const nowIso = new Date().toISOString();
    const existing = overrides.find(
      (o) => o.user_id === currentUserId && o.area_id === areaId && o.date === today
    );
    set({
      overrides: existing
        ? overrides.map((o) => (o.id === existing.id ? { ...o, note, updated_at: nowIso } : o))
        : [
            ...overrides,
            {
              id: `local-${currentUserId}-${areaId}-${today}`,
              user_id: currentUserId,
              area_id: areaId,
              date: today,
              note,
              created_at: nowIso,
              updated_at: nowIso,
            },
          ],
    });
  },

  friendSchedules: (areaId) => {
    const { schedules, overrides, friendAreaLinks, friendIds, currentUserId } = get();
    if (!currentUserId) return [];
    const today = todayDateString(new Date());

    return friendIds.map((friendId) =>
      resolveFriendSchedule(currentUserId, friendId, areaId, today, friendAreaLinks, schedules, overrides)
    );
  },

  friendSchedule: (friendId, areaId) => {
    const { schedules, overrides, friendAreaLinks, currentUserId } = get();
    const today = todayDateString(new Date());
    if (!currentUserId) {
      return { userId: friendId, note: null, overrideNote: null };
    }
    return resolveFriendSchedule(
      currentUserId,
      friendId,
      areaId,
      today,
      friendAreaLinks,
      schedules,
      overrides
    );
  },
}));
