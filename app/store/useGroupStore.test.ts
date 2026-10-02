import { useGroupStore } from './useGroupStore';
import * as groupsApi from '../lib/groups';
import { Group, GroupMember } from '../mocks/groups';

// Issue #315: オープングループの招待コード参加フロー（joinOpenGroupByInviteCode）の
// テスト。lib/groups.tsのSupabase呼び出しをモックし、store側の分岐（成功/
// not_found/already_member）を検証する
jest.mock('../lib/groups');

const mockedGroupsApi = groupsApi as jest.Mocked<typeof groupsApi>;

const NOW = '2026-10-02T00:00:00.000Z';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    owner_user_id: 'owner-1',
    name: 'テストグループ',
    invite_code: 'ABC123',
    type: 'open',
    area_id: 'area-1',
    expires_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeMember(overrides: Partial<GroupMember> = {}): GroupMember {
  return {
    id: 'member-1',
    group_id: 'group-1',
    user_id: 'user-1',
    invited_by: null,
    status: 'approved',
    display_name: null,
    display_icon_url: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useGroupStore.setState({ groups: [], members: [], status: 'idle', errorMessage: null });
});

describe('joinOpenGroupByInviteCode', () => {
  test('正しい招待コードで参加に成功する', async () => {
    mockedGroupsApi.findOpenGroupByInviteCode.mockResolvedValue({
      id: 'group-1',
      name: 'テストグループ',
      area_id: 'area-1',
    });
    mockedGroupsApi.joinOpenGroup.mockResolvedValue(undefined);
    mockedGroupsApi.fetchVisibleGroups.mockResolvedValue([makeGroup()]);
    mockedGroupsApi.fetchVisibleGroupMembers.mockResolvedValue([
      makeMember({ id: 'member-new', user_id: 'user-1' }),
    ]);

    const result = await useGroupStore.getState().joinOpenGroupByInviteCode('ABC123', 'user-1');

    expect(result).toEqual({
      status: 'success',
      groupId: 'group-1',
      groupName: 'テストグループ',
      memberId: 'member-new',
    });
    expect(mockedGroupsApi.joinOpenGroup).toHaveBeenCalledWith('group-1', 'user-1', 'area-1');
  });

  // find_open_group_by_invite_code（security definer RPC）は
  // type='open' かつ (expires_at is null or expires_at > now()) の行だけを返すため
  // （supabase/migrations/20261001140000_group_open_closed_type.sql）、
  // 期限切れのオープングループ・closedグループのコード・存在しないコードは
  // クライアント側からは区別できず、いずれも同じnot_foundになる
  test.each([
    ['期限切れのオープングループのコード'],
    ['closedグループのコード'],
    ['存在しないコード'],
  ])('%sの場合はnot_foundを返す', async () => {
    mockedGroupsApi.findOpenGroupByInviteCode.mockResolvedValue(null);

    const result = await useGroupStore.getState().joinOpenGroupByInviteCode('XXXXXX', 'user-1');

    expect(result).toEqual({ status: 'not_found' });
    expect(mockedGroupsApi.joinOpenGroup).not.toHaveBeenCalled();
  });

  test('既にpending/approvedでメンバーの場合はjoinOpenGroupを呼ばずalready_memberを返す', async () => {
    mockedGroupsApi.findOpenGroupByInviteCode.mockResolvedValue({
      id: 'group-1',
      name: 'テストグループ',
      area_id: 'area-1',
    });
    useGroupStore.setState({
      members: [makeMember({ status: 'approved' })],
    });

    const result = await useGroupStore.getState().joinOpenGroupByInviteCode('ABC123', 'user-1');

    expect(result).toEqual({ status: 'already_member' });
    expect(mockedGroupsApi.joinOpenGroup).not.toHaveBeenCalled();
  });

  test('rejected済みの場合は既存メンバー扱いにならず再参加できる', async () => {
    mockedGroupsApi.findOpenGroupByInviteCode.mockResolvedValue({
      id: 'group-1',
      name: 'テストグループ',
      area_id: 'area-1',
    });
    useGroupStore.setState({
      members: [makeMember({ id: 'member-old', status: 'rejected' })],
    });
    mockedGroupsApi.joinOpenGroup.mockResolvedValue(undefined);
    mockedGroupsApi.fetchVisibleGroups.mockResolvedValue([makeGroup()]);
    mockedGroupsApi.fetchVisibleGroupMembers.mockResolvedValue([
      makeMember({ id: 'member-old', status: 'rejected' }),
      makeMember({ id: 'member-new', status: 'approved' }),
    ]);

    const result = await useGroupStore.getState().joinOpenGroupByInviteCode('ABC123', 'user-1');

    expect(result).toEqual({
      status: 'success',
      groupId: 'group-1',
      groupName: 'テストグループ',
      memberId: 'member-new',
    });
  });

  // 匿名セッション（Issue #151のsignInAnonymously経由）のuserIdも、通常ユーザーと
  // 同じ文字列（auth.users.id）として渡される。参加可否の制御はRLS側
  // （supabase/migrations/20261001170000_anonymous_open_group_join.sql）で
  // 行われるため、store側に匿名/通常の分岐が無いことを確認する
  test('匿名セッションのuserIdでも通常ユーザーと同じコードパスで参加できる', async () => {
    const anonymousUserId = 'anon-session-user-id';
    mockedGroupsApi.findOpenGroupByInviteCode.mockResolvedValue({
      id: 'group-1',
      name: 'テストグループ',
      area_id: 'area-1',
    });
    mockedGroupsApi.joinOpenGroup.mockResolvedValue(undefined);
    mockedGroupsApi.fetchVisibleGroups.mockResolvedValue([makeGroup()]);
    mockedGroupsApi.fetchVisibleGroupMembers.mockResolvedValue([
      makeMember({ id: 'member-anon', user_id: anonymousUserId }),
    ]);

    const result = await useGroupStore.getState().joinOpenGroupByInviteCode('ABC123', anonymousUserId);

    expect(result).toEqual({
      status: 'success',
      groupId: 'group-1',
      groupName: 'テストグループ',
      memberId: 'member-anon',
    });
    expect(mockedGroupsApi.joinOpenGroup).toHaveBeenCalledWith('group-1', anonymousUserId, 'area-1');
  });
});
