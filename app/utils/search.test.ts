import { matchesSearchQuery } from './search';

describe('matchesSearchQuery', () => {
  it('空文字のクエリは常に一致する', () => {
    expect(matchesSearchQuery('田中太郎', '')).toBe(true);
  });

  it('空白のみのクエリも常に一致する', () => {
    expect(matchesSearchQuery('田中太郎', '   ')).toBe(true);
  });

  it('部分一致する場合はtrue', () => {
    expect(matchesSearchQuery('田中太郎', '太郎')).toBe(true);
  });

  it('部分一致しない場合はfalse', () => {
    expect(matchesSearchQuery('田中太郎', '鈴木')).toBe(false);
  });

  it('大小文字を区別しない', () => {
    expect(matchesSearchQuery('Alice', 'ali')).toBe(true);
    expect(matchesSearchQuery('alice', 'ALI')).toBe(true);
  });

  it('前後の空白はトリムしてから判定する', () => {
    expect(matchesSearchQuery('田中太郎', '  太郎  ')).toBe(true);
  });
});
