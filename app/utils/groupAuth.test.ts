import { isGroupAdmin } from './groupAuth';
import { Group } from '../mocks/groups';

describe('isGroupAdmin', () => {
  const group: Group = {
    id: 'group-1',
    owner_user_id: 'user-me',
    name: 'テストグループ',
    invite_code: 'ABCD12',
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
