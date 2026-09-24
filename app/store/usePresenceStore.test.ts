import { resolveDisplayName, buildInitialState, buildPresenceMarkers, PresenceLocation } from './usePresenceStore';
import { Friendship, FriendAreaLink, PresenceLog, User } from '../mocks/presence';
import { Area } from '../mocks/areas';

const now = '2026-08-16T00:00:00.000Z';
const CURRENT_USER_ID = 'user-me';

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
  { id: 'user-a', name: '田中', icon_url: 'https://example.com/a.png', status: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now },
  { id: 'user-b', name: '鈴木', icon_url: null, status: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now },
];

describe('resolveDisplayName', () => {
  test('自分が提案したapprovedなFRIEND_AREA_LINKSが存在する場合、名前を返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName(CURRENT_USER_ID, 'user-a', area.id, links, users)).toBe('田中');
  });

  test('友達側が提案したapprovedなFRIEND_AREA_LINKSでも名前を返す（方向を問わない）', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: 'user-a', friend_id: CURRENT_USER_ID, area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName(CURRENT_USER_ID, 'user-a', area.id, links, users)).toBe('田中');
  });

  test('pendingの場合はnullを返す（承認されるまで名前を出さない）', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-b', initiator_id: CURRENT_USER_ID, friend_id: 'user-b', area_id: area.id, status: 'pending', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName(CURRENT_USER_ID, 'user-b', area.id, links, users)).toBeNull();
  });

  test('該当するFRIEND_AREA_LINKS自体が存在しない場合はnullを返す', () => {
    expect(resolveDisplayName(CURRENT_USER_ID, 'user-a', area.id, [], users)).toBeNull();
  });

  test('approvedでもエリアが異なる場合はnullを返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: 'other-area', status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName(CURRENT_USER_ID, 'user-a', area.id, links, users)).toBeNull();
  });

  test('US-013：approvedでも友達が匿名モード中（is_anonymous）ならnullを返す', () => {
    const anonymousUsers: User[] = [{ ...users[0], is_anonymous: true }, users[1]];
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveDisplayName(CURRENT_USER_ID, 'user-a', area.id, links, anonymousUsers)).toBeNull();
  });
});

describe('buildInitialState', () => {
  test('活動中の友達を対象に名前・アイコンを解決し、在席人数はエリア全体を集計する', () => {
    const friendships: Friendship[] = [
      { id: 'f-a', user_id: CURRENT_USER_ID, friend_id: 'user-a', notify_enabled: true, muted: false, notify_only_when_copresent: false, want_to_meet: false, status: 'active', created_at: now, updated_at: now },
      { id: 'f-b', user_id: CURRENT_USER_ID, friend_id: 'user-b', notify_enabled: true, muted: false, notify_only_when_copresent: false, want_to_meet: false, status: 'active', created_at: now, updated_at: now },
    ];
    const friendAreaLinks: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];
    const presenceLogs: PresenceLog[] = [
      { id: 'log-a', user_id: 'user-a', area_id: area.id, entered_at: now, exited_at: null },
      // 友達ではない第三者もエリアに在席している
      { id: 'log-x', user_id: 'user-x', area_id: area.id, entered_at: now, exited_at: null },
    ];

    const result = buildInitialState(CURRENT_USER_ID, friendships, presenceLogs, friendAreaLinks, users, area);

    expect(result.areaName).toBe('部室');
    // 友達(1人在席)＋友達ではない在席者(user-x)を合わせた、エリア全体の人数
    expect(result.presentCount).toBe(2);
    expect(result.friends).toEqual([
      { userId: 'user-a', displayName: '田中', iconUrl: 'https://example.com/a.png', status: null, isPresent: true },
      { userId: 'user-b', displayName: null, iconUrl: null, status: null, isPresent: false },
    ]);
  });

  test('非公開（displayNameがnull）の友達はicon_urlが設定されていてもiconUrlをnullにする', () => {
    const friendships: Friendship[] = [
      { id: 'f-a', user_id: CURRENT_USER_ID, friend_id: 'user-a', notify_enabled: true, muted: false, notify_only_when_copresent: false, want_to_meet: false, status: 'active', created_at: now, updated_at: now },
    ];

    // FRIEND_AREA_LINKSが無い＝非公開のはずなのに、icon_urlは設定されている状況
    const result = buildInitialState(CURRENT_USER_ID, friendships, [], [], users, area);

    expect(result.friends).toEqual([
      { userId: 'user-a', displayName: null, iconUrl: null, status: null, isPresent: false },
    ]);
  });

  test('非公開（displayNameがnull）の友達はstatusが設定されていてもstatusをnullにする（Issue #10）', () => {
    const friendships: Friendship[] = [
      { id: 'f-a', user_id: CURRENT_USER_ID, friend_id: 'user-a', notify_enabled: true, muted: false, notify_only_when_copresent: false, want_to_meet: false, status: 'active', created_at: now, updated_at: now },
    ];
    const usersWithStatus: User[] = [
      { ...users[0], status: 'working' },
    ];

    // FRIEND_AREA_LINKSが無い＝非公開のはずなのに、statusは設定されている状況
    const result = buildInitialState(CURRENT_USER_ID, friendships, [], [], usersWithStatus, area);

    expect(result.friends).toEqual([
      { userId: 'user-a', displayName: null, iconUrl: null, status: null, isPresent: false },
    ]);
  });

  test('US-013：匿名モード中の友達は、承認済みでも名前だけでなく在席（isPresent）も非表示にする', () => {
    const friendships: Friendship[] = [
      { id: 'f-a', user_id: CURRENT_USER_ID, friend_id: 'user-a', notify_enabled: true, muted: false, notify_only_when_copresent: false, want_to_meet: false, status: 'active', created_at: now, updated_at: now },
    ];
    const friendAreaLinks: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: area.id, status: 'approved', created_at: now, updated_at: now },
    ];
    const presenceLogs: PresenceLog[] = [
      { id: 'log-a', user_id: 'user-a', area_id: area.id, entered_at: now, exited_at: null },
    ];
    const anonymousUsers: User[] = [{ ...users[0], is_anonymous: true }, users[1]];

    const result = buildInitialState(
      CURRENT_USER_ID,
      friendships,
      presenceLogs,
      friendAreaLinks,
      anonymousUsers,
      area
    );

    expect(result.friends).toEqual([
      { userId: 'user-a', displayName: null, iconUrl: null, status: null, isPresent: false },
    ]);
    // 在席人数（presentCount）はエリア全体の集計なので、匿名モードの影響を受けない
    expect(result.presentCount).toBe(1);
  });

  test('自分以外が起点のfriendshipsは対象に含めない', () => {
    const friendships: Friendship[] = [
      { id: 'f-x', user_id: 'user-a', friend_id: CURRENT_USER_ID, notify_enabled: true, muted: false, notify_only_when_copresent: false, want_to_meet: false, status: 'active', created_at: now, updated_at: now },
    ];

    const result = buildInitialState(CURRENT_USER_ID, friendships, [], [], users, area);

    expect(result.friends).toEqual([]);
    expect(result.presentCount).toBe(0);
  });
});

describe('buildPresenceMarkers', () => {
  test('visibleUserIdsに含まれるユーザーは名前・アイコンつきで返す', () => {
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: 35.0, lng: 135.0 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(['user-a']), users);

    expect(result).toEqual([
      { userId: 'user-a', latitude: 35.0, longitude: 135.0, displayName: '田中', iconUrl: 'https://example.com/a.png' },
    ]);
  });

  test('visibleUserIdsに含まれないユーザーはdisplayName・iconUrlともnullにする', () => {
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: 35.0, lng: 135.0 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(), users);

    expect(result).toEqual([
      { userId: 'user-a', latitude: 35.0, longitude: 135.0, displayName: null, iconUrl: null },
    ]);
  });

  test('自分自身はvisibleUserIdsに無くても常に表示する', () => {
    const selfUser: User = { id: CURRENT_USER_ID, name: '自分', icon_url: null, status: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now };
    const locations: PresenceLocation[] = [
      { user_id: CURRENT_USER_ID, lat: 35.0, lng: 135.0 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(), [selfUser]);

    expect(result).toEqual([
      { userId: CURRENT_USER_ID, latitude: 35.0, longitude: 135.0, displayName: '自分', iconUrl: null },
    ]);
  });

  test('lat/lngがnullの行はマーカーの対象から除外する', () => {
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: null, lng: null },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(['user-a']), users);

    expect(result).toEqual([]);
  });
});
