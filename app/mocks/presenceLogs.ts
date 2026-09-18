// docs/schema.md の PRESENCE_LOGS 定義に対応するモックデータ。
// exited_at が null の間は在席中を意味する。

export type PresenceLog = {
  id: string;
  user_id: string;
  area_id: string;
  entered_at: string;
  exited_at: string | null;
};

export const mockPresenceLogs: PresenceLog[] = [
  {
    id: 'log-1',
    user_id: 'user-1',
    area_id: 'area-1',
    entered_at: '2026-08-15T09:00:00.000Z',
    exited_at: null,
  },
];
