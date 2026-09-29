import { create } from 'zustand';

import { CURRENT_USER_ID, mockFriendships, mockPresenceLogs, mockUsers, presenceArea } from '../mocks/presence';
import { mockGroupMembers } from '../mocks/groups';
import { getGroupMateIds } from '../utils/groupAuth';
import { buildMeetableUsers, MeetableUser } from '../utils/meetable';

export type ArrivalSummary = {
  id: string;
  areaId: string;
  areaName: string;
  enteredAt: string;
  meetableUsers: MeetableUser[];
};

type ArrivalSummaryState = {
  summaries: ArrivalSummary[];
  // 入室検知時に呼び出す想定のaction（US-021、Issue #16）。現状は
  // FRIENDSHIPS/GROUPSがバックエンド未接続のため、useGeofenceMonitorからは
  // 呼ばれていない（下記buildInitialSummaryでモックの1件を初期表示している）。
  // バックエンド接続後、useGeofenceMonitorの入室検知からこれを呼ぶ形に置き換える
  addArrivalSummary: (summary: ArrivalSummary) => void;
};

const now = '2026-08-16T09:35:00+09:00';

// FRIENDSHIPS/GROUPSがバックエンド未接続の段階のモック初期表示（Issue #16）。
// 実際の入室検知とは連動していない
function buildInitialSummary(): ArrivalSummary {
  const presentUserIds = mockPresenceLogs
    .filter((log) => log.area_id === presenceArea.id && log.exited_at === null && log.user_id !== CURRENT_USER_ID)
    .map((log) => log.user_id);
  const friendIds = new Set(
    mockFriendships.filter((f) => f.user_id === CURRENT_USER_ID).map((f) => f.friend_id)
  );
  const groupMateIds = getGroupMateIds(CURRENT_USER_ID, mockGroupMembers);
  const meetableUsers = buildMeetableUsers(presentUserIds, friendIds, groupMateIds, mockUsers);

  return {
    id: 'arrival-summary-mock-1',
    areaId: presenceArea.id,
    areaName: presenceArea.name,
    enteredAt: now,
    meetableUsers,
  };
}

export const useArrivalSummaryStore = create<ArrivalSummaryState>((set) => ({
  summaries: [buildInitialSummary()],

  addArrivalSummary: (summary) =>
    set((state) => ({ summaries: [summary, ...state.summaries] })),
}));
