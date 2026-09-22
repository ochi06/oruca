// docs/schema.md の AREA_SCHEDULES / AREA_SCHEDULE_OVERRIDES 定義に対応する
// モックデータ。バックエンド未接続の段階でUIを動かすための仮データ
// （app/mocks/presence.ts と同じ方針）。

import { presenceArea } from './presence';

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

const now = '2026-09-19T00:00:00.000Z';
export const TODAY = '2026-09-19';

// mocks/presence.ts のFRIEND_AREA_LINKSと対応：
// user-a は presenceArea で approved（予定が見える）、
// user-b は pending（見えない）、user-c はリンク自体が無い（見えない）
export const mockAreaSchedules: AreaSchedule[] = [
  {
    id: 'schedule-me',
    user_id: 'user-me',
    area_id: presenceArea.id,
    note: '平日9-19時、土日は不定期',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'schedule-a',
    user_id: 'user-a',
    area_id: presenceArea.id,
    note: '平日10-18時',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'schedule-b',
    user_id: 'user-b',
    area_id: presenceArea.id,
    note: '平日9-17時',
    created_at: now,
    updated_at: now,
  },
];

export const mockAreaScheduleOverrides: AreaScheduleOverride[] = [
  {
    id: 'override-a',
    user_id: 'user-a',
    area_id: presenceArea.id,
    date: TODAY,
    note: '今日は17時退勤',
    created_at: now,
    updated_at: now,
  },
];
