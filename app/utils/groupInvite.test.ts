import { generateInviteCode } from './groupInvite';

describe('generateInviteCode', () => {
  test('英大文字・数字のみの6文字を返す', () => {
    const code = generateInviteCode();

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('呼び出すたびに（十分な確率で）異なるコードを返す', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));

    expect(codes.size).toBeGreaterThan(1);
  });
});
