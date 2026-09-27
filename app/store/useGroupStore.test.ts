import { useGroupStore } from './useGroupStore';
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
      created_at: now,
      updated_at: now,
    },
    {
      id: 'member-a',
      group_id: group.id,
      user_id: MEMBER_ID,
      invited_by: null,
      status: 'approved',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'member-pending',
      group_id: group.id,
      user_id: OTHER_MEMBER_ID,
      invited_by: null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    },
  ];
  return { group, members };
}

beforeEach(() => {
  const { group, members } = buildFixture();
  useGroupStore.setState({ groups: [group], members });
});

describe('createGroup', () => {
  it('groupsに新しいグループを追加し、作成者をowner_user_idにする', () => {
    const newGroup = useGroupStore.getState().createGroup('新しいグループ', OWNER_ID);

    expect(newGroup.name).toBe('新しいグループ');
    expect(newGroup.owner_user_id).toBe(OWNER_ID);
    expect(useGroupStore.getState().groups).toContainEqual(newGroup);
  });

  it('作成者を承認済みメンバーとしても登録する', () => {
    const newGroup = useGroupStore.getState().createGroup('新しいグループ', OWNER_ID);

    const ownerMember = useGroupStore
      .getState()
      .members.find((m) => m.group_id === newGroup.id && m.user_id === OWNER_ID);
    expect(ownerMember?.status).toBe('approved');
    expect(ownerMember?.invited_by).toBeNull();
  });

  it('既存のgroups/membersは維持したまま追加する', () => {
    useGroupStore.getState().createGroup('新しいグループ', OWNER_ID);

    expect(useGroupStore.getState().groups.some((g) => g.id === 'group-1')).toBe(true);
    expect(useGroupStore.getState().members.some((m) => m.id === 'member-owner')).toBe(true);
  });
});

describe('inviteMember', () => {
  it('招待されていない友達を招待すると、pendingなGROUP_MEMBERS行を追加する', () => {
    const result = useGroupStore.getState().inviteMember('group-1', INVITEE_ID, MEMBER_ID);

    expect(result).toEqual({ status: 'success' });
    const invited = useGroupStore.getState().members.find((m) => m.user_id === INVITEE_ID);
    expect(invited).toMatchObject({ group_id: 'group-1', status: 'pending', invited_by: MEMBER_ID });
  });

  it('既にpending/approvedなメンバーは招待できない', () => {
    const result = useGroupStore.getState().inviteMember('group-1', MEMBER_ID, OWNER_ID);

    expect(result).toEqual({ status: 'already_member' });
  });

  it('rejected済みの相手は再招待できる', () => {
    useGroupStore.setState({
      members: [
        ...useGroupStore.getState().members,
        {
          id: 'member-rejected',
          group_id: 'group-1',
          user_id: INVITEE_ID,
          invited_by: MEMBER_ID,
          status: 'rejected',
          created_at: now,
          updated_at: now,
        },
      ],
    });

    const result = useGroupStore.getState().inviteMember('group-1', INVITEE_ID, MEMBER_ID);

    expect(result).toEqual({ status: 'success' });
  });

  it('存在しないグループへの招待はnot_foundを返す', () => {
    const result = useGroupStore.getState().inviteMember('group-unknown', INVITEE_ID, MEMBER_ID);

    expect(result).toEqual({ status: 'not_found' });
  });
});

describe('acceptInvitation / declineInvitation', () => {
  beforeEach(() => {
    useGroupStore.setState({
      members: [
        ...useGroupStore.getState().members,
        {
          id: 'member-invitation',
          group_id: 'group-1',
          user_id: INVITEE_ID,
          invited_by: MEMBER_ID,
          status: 'pending',
          created_at: now,
          updated_at: now,
        },
      ],
    });
  });

  it('招待された本人は承諾できる', () => {
    const result = useGroupStore.getState().acceptInvitation('member-invitation', INVITEE_ID);

    expect(result).toEqual({ status: 'success' });
    expect(useGroupStore.getState().members.find((m) => m.id === 'member-invitation')?.status).toBe('approved');
  });

  it('招待された本人は辞退できる', () => {
    const result = useGroupStore.getState().declineInvitation('member-invitation', INVITEE_ID);

    expect(result).toEqual({ status: 'success' });
    expect(useGroupStore.getState().members.find((m) => m.id === 'member-invitation')?.status).toBe('rejected');
  });

  it('本人以外は承諾できない', () => {
    const result = useGroupStore.getState().acceptInvitation('member-invitation', OTHER_MEMBER_ID);

    expect(result).toEqual({ status: 'forbidden' });
  });

  it('本人以外は辞退できない', () => {
    const result = useGroupStore.getState().declineInvitation('member-invitation', OTHER_MEMBER_ID);

    expect(result).toEqual({ status: 'forbidden' });
  });
});

describe('leaveGroup', () => {
  it('管理者ではない承認済みメンバーは退会できる', () => {
    const result = useGroupStore.getState().leaveGroup('group-1', MEMBER_ID);

    expect(result).toEqual({ status: 'success' });
    expect(useGroupStore.getState().members.some((m) => m.user_id === MEMBER_ID)).toBe(false);
  });

  it('自分が最後の管理者（owner_user_id）の場合は退会できない', () => {
    const result = useGroupStore.getState().leaveGroup('group-1', OWNER_ID);

    expect(result).toEqual({ status: 'last_admin' });
    // 退会は拒否され、メンバーリストは変化しない
    expect(useGroupStore.getState().members.some((m) => m.user_id === OWNER_ID)).toBe(true);
  });

  it('存在しないグループ・メンバーはnot_foundを返す', () => {
    expect(useGroupStore.getState().leaveGroup('group-x', MEMBER_ID)).toEqual({ status: 'not_found' });
    expect(useGroupStore.getState().leaveGroup('group-1', 'user-unknown')).toEqual({ status: 'not_found' });
  });
});

describe('transferOwnership', () => {
  it('管理者が承認済みの別メンバーに権限を譲渡できる', () => {
    const result = useGroupStore.getState().transferOwnership('group-1', MEMBER_ID, OWNER_ID);

    expect(result).toEqual({ status: 'success' });
    expect(useGroupStore.getState().groups.find((g) => g.id === 'group-1')?.owner_user_id).toBe(MEMBER_ID);
  });

  it('管理者以外が譲渡しようとするとforbiddenを返す', () => {
    const result = useGroupStore.getState().transferOwnership('group-1', OTHER_MEMBER_ID, MEMBER_ID);

    expect(result).toEqual({ status: 'forbidden' });
    expect(useGroupStore.getState().groups.find((g) => g.id === 'group-1')?.owner_user_id).toBe(OWNER_ID);
  });

  it('譲渡先が承認済みメンバーでない場合はnot_foundを返す（承認待ちメンバー）', () => {
    const result = useGroupStore.getState().transferOwnership('group-1', OTHER_MEMBER_ID, OWNER_ID);

    expect(result).toEqual({ status: 'not_found' });
    expect(useGroupStore.getState().groups.find((g) => g.id === 'group-1')?.owner_user_id).toBe(OWNER_ID);
  });

  it('譲渡後、旧管理者は退会できるようになる', () => {
    useGroupStore.getState().transferOwnership('group-1', MEMBER_ID, OWNER_ID);

    const result = useGroupStore.getState().leaveGroup('group-1', OWNER_ID);

    expect(result).toEqual({ status: 'success' });
  });
});
