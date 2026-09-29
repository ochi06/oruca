import { buildMeetableUsers } from './meetable';
import { User } from '../mocks/presence';

const now = '2026-09-19T00:00:00.000Z';

function user(id: string, name: string): User {
  return {
    id,
    name,
    icon_url: null,
    status: null,
    is_anonymous: false,
    allow_entry_notifications: true,
    created_at: now,
    updated_at: now,
  };
}

describe('buildMeetableUsers', () => {
  const users = [user('user-a', '田中'), user('user-b', '鈴木'), user('user-c', '佐藤')];

  it('在席中の友達を会える人として返す', () => {
    const result = buildMeetableUsers(['user-a'], new Set(['user-a']), new Set(), users);

    expect(result).toEqual([{ userId: 'user-a', displayName: '田中', iconUrl: null }]);
  });

  it('在席中のグループメンバーも会える人として返す（友達でなくても良い）', () => {
    const result = buildMeetableUsers(['user-b'], new Set(), new Set(['user-b']), users);

    expect(result).toEqual([{ userId: 'user-b', displayName: '鈴木', iconUrl: null }]);
  });

  it('友達でもグループメンバーでもない在席者は含めない', () => {
    const result = buildMeetableUsers(['user-c'], new Set(['user-a']), new Set(['user-b']), users);

    expect(result).toEqual([]);
  });

  it('在席していない友達・グループメンバーは含めない', () => {
    const result = buildMeetableUsers([], new Set(['user-a']), new Set(['user-b']), users);

    expect(result).toEqual([]);
  });
});
