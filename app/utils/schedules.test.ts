import { resolveFriendSchedule } from './schedules';
import { FriendAreaLink } from '../mocks/presence';
import { AreaSchedule, AreaScheduleOverride } from '../mocks/schedules';

const now = '2026-09-19T00:00:00.000Z';
const CURRENT_USER_ID = 'user-me';
const AREA_ID = 'area-1';
const DATE = '2026-09-19';

const schedules: AreaSchedule[] = [
  { id: 's-a', user_id: 'user-a', area_id: AREA_ID, note: '平日10-18時', created_at: now, updated_at: now },
];

const overrides: AreaScheduleOverride[] = [
  { id: 'o-a', user_id: 'user-a', area_id: AREA_ID, date: DATE, note: '今日は17時退勤', created_at: now, updated_at: now },
];

describe('resolveFriendSchedule', () => {
  test('自分が提案したapprovedなFRIEND_AREA_LINKSが存在する場合、予定を返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: AREA_ID, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveFriendSchedule(CURRENT_USER_ID, 'user-a', AREA_ID, DATE, links, schedules, overrides)).toEqual({
      userId: 'user-a',
      note: '平日10-18時',
      overrideNote: '今日は17時退勤',
    });
  });

  test('友達側が提案したapprovedなFRIEND_AREA_LINKSでも予定を返す（方向を問わない）', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: 'user-a', friend_id: CURRENT_USER_ID, area_id: AREA_ID, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveFriendSchedule(CURRENT_USER_ID, 'user-a', AREA_ID, DATE, links, schedules, overrides)).toEqual({
      userId: 'user-a',
      note: '平日10-18時',
      overrideNote: '今日は17時退勤',
    });
  });

  test('pendingの場合はnoteもoverrideNoteもnullを返す（承認されるまで公開しない）', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: AREA_ID, status: 'pending', created_at: now, updated_at: now },
    ];

    expect(resolveFriendSchedule(CURRENT_USER_ID, 'user-a', AREA_ID, DATE, links, schedules, overrides)).toEqual({
      userId: 'user-a',
      note: null,
      overrideNote: null,
    });
  });

  test('該当するFRIEND_AREA_LINKS自体が存在しない場合はnullを返す', () => {
    expect(resolveFriendSchedule(CURRENT_USER_ID, 'user-a', AREA_ID, DATE, [], schedules, overrides)).toEqual({
      userId: 'user-a',
      note: null,
      overrideNote: null,
    });
  });

  test('approvedでもエリアが異なる場合はnullを返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: 'other-area', status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveFriendSchedule(CURRENT_USER_ID, 'user-a', AREA_ID, DATE, links, schedules, overrides)).toEqual({
      userId: 'user-a',
      note: null,
      overrideNote: null,
    });
  });

  test('承認済みでも基本予定・当日上書きが未登録ならnoteはnullを返す', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-b', initiator_id: CURRENT_USER_ID, friend_id: 'user-b', area_id: AREA_ID, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(resolveFriendSchedule(CURRENT_USER_ID, 'user-b', AREA_ID, DATE, links, schedules, overrides)).toEqual({
      userId: 'user-b',
      note: null,
      overrideNote: null,
    });
  });

  test('当日上書きが無い日付では、基本予定のみ返しoverrideNoteはnullになる', () => {
    const links: FriendAreaLink[] = [
      { id: 'link-a', initiator_id: CURRENT_USER_ID, friend_id: 'user-a', area_id: AREA_ID, status: 'approved', created_at: now, updated_at: now },
    ];

    expect(
      resolveFriendSchedule(CURRENT_USER_ID, 'user-a', AREA_ID, '2026-09-20', links, schedules, overrides)
    ).toEqual({
      userId: 'user-a',
      note: '平日10-18時',
      overrideNote: null,
    });
  });
});
