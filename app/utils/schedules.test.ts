import { friendIdsWithVisibleNotes } from './schedules';

describe('friendIdsWithVisibleNotes', () => {
  test('schedule_noteが空でないuserのidを含む', () => {
    const result = friendIdsWithVisibleNotes([
      { id: 'user-a', schedule_note: '平日10-18時', status_message: null },
    ]);
    expect(result.has('user-a')).toBe(true);
  });

  test('status_messageが空でないuserのidを含む', () => {
    const result = friendIdsWithVisibleNotes([
      { id: 'user-a', schedule_note: null, status_message: '今日は学校にいる！' },
    ]);
    expect(result.has('user-a')).toBe(true);
  });

  test('schedule_note・status_messageがどちらも空文字（トリムして空）の場合は含まない', () => {
    const result = friendIdsWithVisibleNotes([
      { id: 'user-b', schedule_note: '   ', status_message: '' },
    ]);
    expect(result.has('user-b')).toBe(false);
  });

  test('schedule_note・status_messageがどちらもnullの場合は含まない', () => {
    const result = friendIdsWithVisibleNotes([
      { id: 'user-c', schedule_note: null, status_message: null },
    ]);
    expect(result.has('user-c')).toBe(false);
  });

  test('該当者がいなければ空のSetを返す', () => {
    const result = friendIdsWithVisibleNotes([]);
    expect(result.size).toBe(0);
  });
});
