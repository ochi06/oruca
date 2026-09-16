import { resolveDisplayName, buildInitialState } from './usePresenceStore';
import { Friendship, FriendAreaLink, PresenceLog, User } from '../mocks/presence';
import { Area } from '../mocks/areas';

const now = '2026-08-16T00:00:00.000Z';

const area: Area = {
  id: 'area-1',
  owner_user_id: 'user-me',
  name: '部室',
  center_lat: 35.0,
  center_lng: 135.0,
  radius_m: 30,
  is_public: true,
  created_at: now,
  updated_at: now,
};

const users: User[] = [
  { id: 'user-a', name: '田中', icon_url: null, created_at: now, updated_at: now },
  { id: 'user-b', name: '鈴木', icon_url: null, created_at: now, updated_at: now },
];

describe('resolveDisplayName', () => {
  test('approvedなFRIEND_AREA_LINKSが存在する場合、名前を返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: 'user-me', friend_id: 'user-a', area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName('user-a', area.id, links, users)).toBe('田中');
  });

  test('pendingの場合はnullを返す（承認されるまで名前を出さない）', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-b', initiator_id: 'user-me', friend_id: 'user-b', area_id: area.id, status: 'pending', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName('user-b', area.id, links, users)).toBeNull();
  });

  test('該当するFRIEND_AREA_LINKS自体が存在しない場合はnullを返す', () => {
    expect(resolveDisplayName('user-a', area.id, [], users)).toBeNull();
  });

  test('approvedでもエリアが異なる場合はnullを返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: 'user-me', friend_id: 'user-a', area_id: 'other-area', status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName('user-a', area.id, links, users)).toBeNull();
  });
});

describe('buildInitialState', () => {
  test('活動中の友達のみを対象にし、在席人数を集計する', () => {
    const friendships: Friendship[] = [
      { id: 'f-a', user_id: 'user-me', friend_id: 'user-a', notify_enabled: true, muted: false, status: 'active', created_at: now, updated_at: now },
      { id: 'f-b', user_id: 'user-me', friend_id: 'user-b', notify_enabled: true, muted: false, status: 'active', created_at: now, updated_at: now },
    ];
    const friendAreaLinks: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: 'user-me', friend_id: 'user-a', area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];
    const presenceLogs: PresenceLog[] = [
      { id: 'log-a', user_id: 'user-a', area_id: area.id, entered_at: now, exited_at: null },
    ];

    const result = buildInitialState('user-me', friendships, presenceLogs, friendAreaLinks, users, area);

    expect(result.areaName).toBe('部室');
    expect(result.presentCount).toBe(1);
    expect(result.friends).toEqual([
      { userId: 'user-a', displayName: '田中', isPresent: true },
      { userId: 'user-b', displayName: null, isPresent: false },
    ]);
  });

  test('自分以外が起点のfriendshipsは対象に含めない', () => {
    const friendships: Friendship[] = [
      { id: 'f-x', user_id: 'user-a', friend_id: 'user-me', notify_enabled: true, muted: false, status: 'active', created_at: now, updated_at: now },
    ];

    const result = buildInitialState('user-me', friendships, [], [], users, area);

    expect(result.friends).toEqual([]);
    expect(result.presentCount).toBe(0);
  });
});
