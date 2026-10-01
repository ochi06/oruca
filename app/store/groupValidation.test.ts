import { checkCanJoin, checkCanLeaveGroup, checkCanTransferOwnership, checkIsGroupOwner } from './groupValidation';
import { Group, GroupMember } from '../mocks/groups';

const now = '2026-09-19T00:00:00.000Z';
const OWNER_ID = 'user-owner';
const MEMBER_ID = 'user-member';
const OTHER_MEMBER_ID = 'user-other';
const INVITEE_ID = 'user-invitee';

function buildFixture(): { group: Group; members: GroupMember[] } {
  const group: Group = {
    id: 'group-1',
    owner_user_id: OWNER_ID,
    name: 'テストグループ',
    invite_code: 'ABCD12',
    is_public: false,
    type: 'closed',
    area_id: null,
    expires_at: null,
    created_at: now,
    updated_at: now,
  };
  const members: GroupMember[] = [
    {
      id: 'member-owner',
      group_id: group.id,
      user_id: OWNER_ID,
      invited_by: null,
      status: 'approved',
      display_name: null,
      display_icon_url: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'member-a',
      group_id: group.id,
      user_id: MEMBER_ID,
      invited_by: null,
      status: 'approved',
      display_name: null,
      display_icon_url: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'member-pending',
      group_id: group.id,
      user_id: OTHER_MEMBER_ID,
      invited_by: null,
      status: 'pending',
      display_name: null,
      display_icon_url: null,
      created_at: now,
      updated_at: now,
    },
  ];
  return { group, members };
}

describe('checkCanJoin', () => {
  it('未所属の相手はnullを返す（招待・申請してよい）', () => {
    const { group, members } = buildFixture();
    expect(checkCanJoin([group], members, 'group-1', INVITEE_ID)).toBeNull();
  });

  it('既にpending/approvedなメンバーはalready_memberを返す', () => {
    const { group, members } = buildFixture();
    expect(checkCanJoin([group], members, 'group-1', MEMBER_ID)).toEqual({ status: 'already_member' });
  });

  it('rejected済みの相手はnullを返す（再招待・再申請してよい）', () => {
    const { group, members } = buildFixture();
    const withRejected = [
      ...members,
      {
        id: 'member-rejected',
        group_id: 'group-1',
        user_id: INVITEE_ID,
        invited_by: MEMBER_ID,
        status: 'rejected' as const,
        display_name: null,
        display_icon_url: null,
        created_at: now,
        updated_at: now,
      },
    ];
    expect(checkCanJoin([group], withRejected, 'group-1', INVITEE_ID)).toBeNull();
  });

  it('存在しないグループはnot_foundを返す', () => {
    const { group, members } = buildFixture();
    expect(checkCanJoin([group], members, 'group-unknown', INVITEE_ID)).toEqual({ status: 'not_found' });
  });
});

describe('checkIsGroupOwner', () => {
  it('管理者本人が操作する場合はnullを返す', () => {
    const { group, members } = buildFixture();
    expect(checkIsGroupOwner([group], members, 'group-1', 'member-pending', OWNER_ID)).toBeNull();
  });

  it('管理者以外が操作しようとするとforbiddenを返す', () => {
    const { group, members } = buildFixture();
    expect(checkIsGroupOwner([group], members, 'group-1', 'member-pending', MEMBER_ID)).toEqual({
      status: 'forbidden',
    });
  });

  it('存在しないグループ・メンバーはnot_foundを返す', () => {
    const { group, members } = buildFixture();
    expect(checkIsGroupOwner([group], members, 'group-x', 'member-pending', OWNER_ID)).toEqual({
      status: 'not_found',
    });
    expect(checkIsGroupOwner([group], members, 'group-1', 'member-unknown', OWNER_ID)).toEqual({
      status: 'not_found',
    });
  });
});

describe('checkCanLeaveGroup', () => {
  it('管理者ではない承認済みメンバーは対象のGROUP_MEMBERS行を返す', () => {
    const { group, members } = buildFixture();
    const result = checkCanLeaveGroup([group], members, 'group-1', MEMBER_ID);
    expect('member' in result && result.member.user_id).toBe(MEMBER_ID);
  });

  it('自分が最後の管理者（owner_user_id）の場合はlast_adminを返す', () => {
    const { group, members } = buildFixture();
    const result = checkCanLeaveGroup([group], members, 'group-1', OWNER_ID);
    expect(result).toEqual({ result: { status: 'last_admin' } });
  });

  it('存在しないグループ・メンバーはnot_foundを返す', () => {
    const { group, members } = buildFixture();
    expect(checkCanLeaveGroup([group], members, 'group-x', MEMBER_ID)).toEqual({ result: { status: 'not_found' } });
    expect(checkCanLeaveGroup([group], members, 'group-1', 'user-unknown')).toEqual({
      result: { status: 'not_found' },
    });
  });
});

describe('checkCanTransferOwnership', () => {
  it('管理者が承認済みの別メンバーに譲渡する場合はokを返す', () => {
    const { group, members } = buildFixture();
    expect(checkCanTransferOwnership([group], members, 'group-1', MEMBER_ID, OWNER_ID)).toEqual({ ok: true });
  });

  it('管理者以外が譲渡しようとするとforbiddenを返す', () => {
    const { group, members } = buildFixture();
    expect(checkCanTransferOwnership([group], members, 'group-1', OTHER_MEMBER_ID, MEMBER_ID)).toEqual({
      result: { status: 'forbidden' },
    });
  });

  it('譲渡先が承認済みメンバーでない場合はnot_foundを返す（承認待ちメンバー）', () => {
    const { group, members } = buildFixture();
    expect(checkCanTransferOwnership([group], members, 'group-1', OTHER_MEMBER_ID, OWNER_ID)).toEqual({
      result: { status: 'not_found' },
    });
  });

  it('存在しないグループはnot_foundを返す', () => {
    const { group, members } = buildFixture();
    expect(checkCanTransferOwnership([group], members, 'group-x', MEMBER_ID, OWNER_ID)).toEqual({
      result: { status: 'not_found' },
    });
  });
});
