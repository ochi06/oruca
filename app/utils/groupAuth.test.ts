import { getGroupMateIds, isGroupAdmin } from './groupAuth';
import { Group, GroupMember } from '../mocks/groups';

describe('isGroupAdmin', () => {
  const group: Group = {
    id: 'group-1',
    owner_user_id: 'user-me',
    name: 'テストグループ',
    invite_code: 'ABCD12',
    is_public: false,
    type: 'closed',
    area_id: null,
    expires_at: null,
    created_at: '2026-09-19T00:00:00.000Z',
    updated_at: '2026-09-19T00:00:00.000Z',
  };

  it('作成者（owner_user_id）はtrueを返す', () => {
    expect(isGroupAdmin(group, 'user-me')).toBe(true);
  });

  it('作成者以外はfalseを返す', () => {
    expect(isGroupAdmin(group, 'user-a')).toBe(false);
  });
});

describe('getGroupMateIds', () => {
  const now = '2026-09-19T00:00:00.000Z';

  function member(groupId: string, userId: string, status: GroupMember['status']): GroupMember {
    return {
      id: `${groupId}-${userId}`,
      group_id: groupId,
      user_id: userId,
      invited_by: null,
      status,
      display_name: null,
      display_icon_url: null,
      created_at: now,
      updated_at: now,
    };
  }

  it('同じグループの承認済みメンバー（自分以外）を返す', () => {
    const members = [
      member('group-1', 'user-me', 'approved'),
      member('group-1', 'user-a', 'approved'),
      member('group-1', 'user-b', 'pending'),
    ];

    const result = getGroupMateIds('user-me', members);

    expect(result).toEqual(new Set(['user-a']));
  });

  it('自分が承認済みでないグループのメンバーは含めない', () => {
    const members = [
      member('group-1', 'user-me', 'pending'),
      member('group-1', 'user-a', 'approved'),
    ];

    const result = getGroupMateIds('user-me', members);

    expect(result).toEqual(new Set());
  });

  it('複数グループにまたがるメンバーも重複なく1回だけ含める', () => {
    const members = [
      member('group-1', 'user-me', 'approved'),
      member('group-2', 'user-me', 'approved'),
      member('group-1', 'user-a', 'approved'),
      member('group-2', 'user-a', 'approved'),
    ];

    const result = getGroupMateIds('user-me', members);

    expect(result).toEqual(new Set(['user-a']));
  });
});
