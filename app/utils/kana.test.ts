import { katakanaToHiragana, toHalfWidth, normalizeForSearch } from './kana';

describe('katakanaToHiragana', () => {
  test('カタカナをひらがなに変換する', () => {
    expect(katakanaToHiragana('ブシツ')).toBe('ぶしつ');
  });

  test('ひらがな・漢字・英数字はそのまま', () => {
    expect(katakanaToHiragana('部室a1ぶ')).toBe('部室a1ぶ');
  });
});

describe('toHalfWidth', () => {
  test('全角英数字を半角に変換する', () => {
    expect(toHalfWidth('Ａｂｃ１２３')).toBe('Abc123');
  });

  test('全角スペースを半角スペースに変換する', () => {
    expect(toHalfWidth('大学　図書館')).toBe('大学 図書館');
  });
});

describe('normalizeForSearch', () => {
  test('カタカナ表記とひらがな表記を同一視できる', () => {
    expect(normalizeForSearch('ブシツ')).toBe(normalizeForSearch('ぶしつ'));
  });

  test('大文字小文字・全角半角の違いを同一視できる', () => {
    expect(normalizeForSearch('ＡＢＣ')).toBe(normalizeForSearch('abc'));
  });
});
