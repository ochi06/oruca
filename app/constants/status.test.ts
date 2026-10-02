import { USER_STATUS_OPTIONS, userStatusIcon, userStatusLabel } from './status';

describe('userStatusLabel', () => {
  test.each(USER_STATUS_OPTIONS.map((option) => [option.value, option.label] as const))(
    '%sのラベルは%sを返す',
    (value, label) => {
      expect(userStatusLabel(value)).toBe(label);
    }
  );

  test('nullの場合はnullを返す', () => {
    expect(userStatusLabel(null)).toBeNull();
  });
});

describe('userStatusIcon', () => {
  test.each(USER_STATUS_OPTIONS.map((option) => [option.value, option.icon] as const))(
    '%sのアイコンは%sを返す',
    (value, icon) => {
      expect(userStatusIcon(value)).toBe(icon);
    }
  );

  test('nullの場合はnullを返す', () => {
    expect(userStatusIcon(null)).toBeNull();
  });

  // Issue #362：離席中のアイコンをmoon-outlineからban-outlineに変更した。
  // 絵文字不使用の方針（developer確認済み）の回帰防止
  test('離席中（away）のアイコンはban-outline', () => {
    expect(userStatusIcon('away')).toBe('ban-outline');
  });
});
