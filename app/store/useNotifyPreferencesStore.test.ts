import { isWantToMeetLimitError } from './useNotifyPreferencesStore';

describe('isWantToMeetLimitError', () => {
  it('DBトリガーの上限超過エラーはtrue', () => {
    expect(isWantToMeetLimitError({ message: 'want_to_meet limit reached (max 5)' })).toBe(true);
  });

  it('無関係なエラーはfalse', () => {
    expect(isWantToMeetLimitError({ message: 'Network request failed' })).toBe(false);
  });

  it('nullはfalse', () => {
    expect(isWantToMeetLimitError(null)).toBe(false);
  });

  it('messageプロパティの無いオブジェクトはfalse', () => {
    expect(isWantToMeetLimitError({ code: '23505' })).toBe(false);
  });
});
