import { resolveFriendAreaLinkState, canProposeFriendAreaLink } from './friendAreaLinks';
import { FriendAreaLink } from '../mocks/presence';

const ME = 'user-me';
const FRIEND = 'user-friend';
const AREA = 'area-1';
const now = '2026-10-02T00:00:00.000Z';

function buildLink(overrides: Partial<FriendAreaLink>): FriendAreaLink {
  return {
    id: 'link-1',
    initiator_id: ME,
    friend_id: FRIEND,
    area_id: AREA,
    status: 'pending',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('resolveFriendAreaLinkState', () => {
  it('該当する行が無ければnoneを返す', () => {
    expect(resolveFriendAreaLinkState([], ME, FRIEND, AREA)).toEqual({ kind: 'none' });
  });

  it('自分が提案したpending行はpending_sentを返す', () => {
    const link = buildLink({ initiator_id: ME, friend_id: FRIEND, status: 'pending' });
    expect(resolveFriendAreaLinkState([link], ME, FRIEND, AREA)).toEqual({ kind: 'pending_sent', link });
  });

  it('相手が提案したpending行はpending_receivedを返す', () => {
    const link = buildLink({ initiator_id: FRIEND, friend_id: ME, status: 'pending' });
    expect(resolveFriendAreaLinkState([link], ME, FRIEND, AREA)).toEqual({ kind: 'pending_received', link });
  });

  it('承認済みの行はapprovedを返す', () => {
    const link = buildLink({ status: 'approved' });
    expect(resolveFriendAreaLinkState([link], ME, FRIEND, AREA)).toEqual({ kind: 'approved', link });
  });

  it('自分が提案し相手が拒否した行はrejected_by_themを返す（自分からは再提案不可）', () => {
    const link = buildLink({ initiator_id: ME, friend_id: FRIEND, status: 'rejected' });
    expect(resolveFriendAreaLinkState([link], ME, FRIEND, AREA)).toEqual({ kind: 'rejected_by_them', link });
  });

  it('相手が提案し自分が拒否した行はrejected_by_meを返す（自分から再提案可）', () => {
    const link = buildLink({ initiator_id: FRIEND, friend_id: ME, status: 'rejected' });
    expect(resolveFriendAreaLinkState([link], ME, FRIEND, AREA)).toEqual({ kind: 'rejected_by_me', link });
  });

  it('他のエリア・他の相手の行は無視する', () => {
    const otherArea = buildLink({ area_id: 'area-2' });
    const otherFriend = buildLink({ friend_id: 'user-other' });
    expect(resolveFriendAreaLinkState([otherArea, otherFriend], ME, FRIEND, AREA)).toEqual({ kind: 'none' });
  });
});

describe('canProposeFriendAreaLink', () => {
  it('noneなら提案できる', () => {
    expect(canProposeFriendAreaLink({ kind: 'none' })).toBe(true);
  });

  it('rejected_by_me（自分が拒否した側）なら再提案できる', () => {
    const link = buildLink({ status: 'rejected' });
    expect(canProposeFriendAreaLink({ kind: 'rejected_by_me', link })).toBe(true);
  });

  it('rejected_by_them（相手が拒否した側）は再提案できない', () => {
    const link = buildLink({ status: 'rejected' });
    expect(canProposeFriendAreaLink({ kind: 'rejected_by_them', link })).toBe(false);
  });

  it('pending_sent/pending_received/approvedは提案できない', () => {
    const link = buildLink({});
    expect(canProposeFriendAreaLink({ kind: 'pending_sent', link })).toBe(false);
    expect(canProposeFriendAreaLink({ kind: 'pending_received', link })).toBe(false);
    expect(canProposeFriendAreaLink({ kind: 'approved', link })).toBe(false);
  });
});
