import { buildPresenceMarkers, buildAreaPresentUsers, PresenceLocation } from './presenceMarkers';
import { User } from '../mocks/presence';

const now = '2026-08-16T00:00:00.000Z';
const CURRENT_USER_ID = 'user-me';

const users: User[] = [
  { id: 'user-a', name: '田中', icon_url: 'https://example.com/a.png', status: null, schedule_note: null, status_message: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now },
  { id: 'user-b', name: '鈴木', icon_url: null, status: null, schedule_note: null, status_message: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now },
];

describe('buildPresenceMarkers', () => {
  test('visibleUserIdsに含まれるユーザーは名前・アイコン・ステータスつきで返す', () => {
    const usersWithStatus: User[] = [{ ...users[0], status: 'working' }, users[1]];
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: 35.0, lng: 135.0 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(['user-a']), usersWithStatus);

    expect(result).toEqual([
      { userId: 'user-a', latitude: 35.0, longitude: 135.0, displayName: '田中', iconUrl: 'https://example.com/a.png', status: 'working' },
    ]);
  });

  test('visibleUserIdsに含まれないユーザーはdisplayName・iconUrl・statusともnullにする', () => {
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: 35.0, lng: 135.0 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(), users);

    expect(result).toEqual([
      { userId: 'user-a', latitude: 35.0, longitude: 135.0, displayName: null, iconUrl: null, status: null },
    ]);
  });

  test('自分自身はvisibleUserIdsに無くても常に表示する', () => {
    const selfUser: User = { id: CURRENT_USER_ID, name: '自分', icon_url: null, status: null, schedule_note: null, status_message: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now };
    const locations: PresenceLocation[] = [
      { user_id: CURRENT_USER_ID, lat: 35.0, lng: 135.0 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(), [selfUser]);

    expect(result).toEqual([
      { userId: CURRENT_USER_ID, latitude: 35.0, longitude: 135.0, displayName: '自分', iconUrl: null, status: null },
    ]);
  });

  test('lat/lngがnullの行はマーカーの対象から除外する', () => {
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: null, lng: null },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(['user-a']), users);

    expect(result).toEqual([]);
  });

  test('Issue #127：同じuser_idの行が複数あっても最初の1件だけをマーカーにする（key重複防止）', () => {
    // 重なり合う2つのエリアに同時在席している場合など、同じユーザーが
    // 複数行のPRESENCE_LOGSを持つケースを想定
    const locations: PresenceLocation[] = [
      { user_id: 'user-a', lat: 35.0, lng: 135.0 },
      { user_id: 'user-a', lat: 35.0001, lng: 135.0001 },
    ];

    const result = buildPresenceMarkers(CURRENT_USER_ID, locations, new Set(['user-a']), users);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      { userId: 'user-a', latitude: 35.0, longitude: 135.0, displayName: '田中', iconUrl: 'https://example.com/a.png', status: null }
    );
  });
});

describe('buildAreaPresentUsers', () => {
  test('visibleUserIdsに含まれるユーザーは名前・アイコン・ステータスつきで返す', () => {
    const userWithStatus: User = { ...users[0], status: 'working' };

    const result = buildAreaPresentUsers(CURRENT_USER_ID, ['user-a'], new Set(['user-a']), [userWithStatus]);

    expect(result).toEqual([
      { userId: 'user-a', displayName: '田中', iconUrl: 'https://example.com/a.png', status: 'working' },
    ]);
  });

  test('visibleUserIdsに含まれないユーザーはdisplayName・iconUrl・statusともnullにする', () => {
    const result = buildAreaPresentUsers(CURRENT_USER_ID, ['user-a'], new Set(), users);

    expect(result).toEqual([
      { userId: 'user-a', displayName: null, iconUrl: null, status: null },
    ]);
  });

  test('自分自身はvisibleUserIdsに無くても常に表示する', () => {
    const selfUser: User = { id: CURRENT_USER_ID, name: '自分', icon_url: null, status: 'focus', schedule_note: null, status_message: null, is_anonymous: false, allow_entry_notifications: true, created_at: now, updated_at: now };

    const result = buildAreaPresentUsers(CURRENT_USER_ID, [CURRENT_USER_ID], new Set(), [selfUser]);

    expect(result).toEqual([
      { userId: CURRENT_USER_ID, displayName: '自分', iconUrl: null, status: 'focus' },
    ]);
  });

  test('areaUserIdsが空なら空配列を返す', () => {
    const result = buildAreaPresentUsers(CURRENT_USER_ID, [], new Set(), users);

    expect(result).toEqual([]);
  });
});
