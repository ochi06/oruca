import { formatTime, formatPresenceCount } from './format'

describe('formatTime', () => {
  test('9時5分を09:05のように0埋めして表示する', () => {
    const date = new Date(2026, 0, 1, 9, 5);
    expect(formatTime(date)).toBe('09:05');
  });

  test('0時0分をゼロ埋めして00:00と表示する', () => {
    const date = new Date(2026, 0, 1, 0, 0);
    expect(formatTime(date)).toBe('00:00');
  });

  test('23時59分を23:59と表示する', () => {
    const date = new Date(2026, 0, 1, 23, 59);
    expect(formatTime(date)).toBe('23:59');
  });
});

describe('formatPresenceCount', () => {
  test('在席人数が0人の場合は「在席中の人はいません」と表示する', () => {
    expect(formatPresenceCount(0)).toBe('在席中の人はいません');
  });

  test('在席人数が1人の場合は「1人在席中」と表示する', () => {
    expect(formatPresenceCount(1)).toBe('1人在席中');
  });

  test('在席人数が複数人の場合は「N人在席中」と表示する', () => {
    expect(formatPresenceCount(5)).toBe('5人在席中');
  });
});
