// docs/schema.md の USERS / FRIENDSHIPS / FRIEND_AREA_LINKS / PRESENCE_LOGS
// 定義に対応するモックデータ。バックエンド未接続の段階でUIを動かすための
// 仮データであり、実DBの型とは将来的にSupabaseのスキーマ定義（生成型）で
// 置き換える想定（app/mocks/areas.ts と同じ方針）。
//
// エリア自体は新規に作らず、既存の app/mocks/areas.ts の mockAreas を流用する
// （共通化の方針、docs/architecture.md参照）。

import { mockAreas } from './areas';

export type User = {
  id: string;
  name: string;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  notify_enabled: boolean;
  muted: boolean;
  status: 'active';
  created_at: string;
  updated_at: string;
};

export type FriendAreaLink = {
  id: string;
  initiator_id: string;
  friend_id: string;
  area_id: string;
  status: 'pending' | 'approved';
  created_at: string;
  updated_at: string;
};

export type PresenceLog = {
  id: string;
  user_id: string;
  area_id: string;
  entered_at: string;
  exited_at: string | null; // null の間は在席中
};

const now = '2026-08-16T00:00:00.000Z';

export const CURRENT_USER_ID = 'user-me';

// 在席確認の対象エリア（既存の部室エリアを流用）
export const presenceArea = mockAreas[0];

export const mockUsers: User[] = [
  { id: 'user-me', name: '自分', icon_url: null, created_at: now, updated_at: now },
  { id: 'user-a', name: '田中', icon_url: null, created_at: now, updated_at: now },
  { id: 'user-b', name: '鈴木', icon_url: null, created_at: now, updated_at: now },
  { id: 'user-c', name: '佐藤', icon_url: null, created_at: now, updated_at: now },
];

// 自分から見た友達関係。今回は user-a, user-b, user-c すべて友達とする
export const mockFriendships: Friendship[] = [
  { id: 'friendship-a', user_id: 'user-me', friend_id: 'user-a', notify_enabled: true, muted: false, status: 'active', created_at: now, updated_at: now },
  { id: 'friendship-b', user_id: 'user-me', friend_id: 'user-b', notify_enabled: true, muted: false, status: 'active', created_at: now, updated_at: now },
  { id: 'friendship-c', user_id: 'user-me', friend_id: 'user-c', notify_enabled: true, muted: false, status: 'active', created_at: now, updated_at: now },
];

// このエリアで名前つきで見せ合うことに合意しているか（approved のみ名前表示）
export const mockFriendAreaLinks: FriendAreaLink[] = [
  { id: 'link-a', initiator_id: 'user-me', friend_id: 'user-a', area_id: presenceArea.id, status: 'approved', created_at: now, updated_at: now },
  { id: 'link-b', initiator_id: 'user-me', friend_id: 'user-b', area_id: presenceArea.id, status: 'pending', created_at: now, updated_at: now },
  // user-c はこのエリアに対する FRIEND_AREA_LINKS 自体が存在しない状態を再現
];

// exited_at が null の人が「在席中」
export const mockPresenceLogs: PresenceLog[] = [
  { id: 'log-a', user_id: 'user-a', area_id: presenceArea.id, entered_at: '2026-08-16T09:00:00+09:00', exited_at: null },
  { id: 'log-b', user_id: 'user-b', area_id: presenceArea.id, entered_at: '2026-08-16T09:30:00+09:00', exited_at: null },
  { id: 'log-c', user_id: 'user-c', area_id: presenceArea.id, entered_at: '2026-08-15T09:00:00+09:00', exited_at: '2026-08-15T18:00:00+09:00' },
];
