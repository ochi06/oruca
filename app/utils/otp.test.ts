import { generateOtpCode, isOtpExpired, OTP_CODE_LENGTH, OTP_TTL_MS, OtpCode } from './otp';

function makeOtp(userId: string, now: Date): OtpCode {
  return {
    id: `otp-${userId}-${now.getTime()}`,
    user_id: userId,
    code: '123456',
    expires_at: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
    created_at: now.toISOString(),
  };
}

describe('generateOtpCode', () => {
  test(`${OTP_CODE_LENGTH}桁の数字文字列を生成する`, () => {
    const code = generateOtpCode();
    expect(code).toHaveLength(OTP_CODE_LENGTH);
    expect(code).toMatch(/^\d+$/);
  });

  test('先頭が0の場合も桁数を保つよう0埋めされる', () => {
    const originalRandom = Math.random;
    Math.random = () => 0; // Math.floor(0 * 10^6) = 0 -> "000000"
    try {
      expect(generateOtpCode()).toBe('000000');
    } finally {
      Math.random = originalRandom;
    }
  });
});

describe('isOtpExpired', () => {
  const otp = makeOtp('user-a', new Date('2026-08-16T00:00:00.000Z'));

  test('失効時刻より前は失効していない', () => {
    const now = new Date('2026-08-16T00:00:59.999Z');
    expect(isOtpExpired(otp, now)).toBe(false);
  });

  test('失効時刻ちょうどは失効済み扱いとする', () => {
    const now = new Date('2026-08-16T00:01:00.000Z');
    expect(isOtpExpired(otp, now)).toBe(true);
  });

  test('失効時刻より後は失効している', () => {
    const now = new Date('2026-08-16T00:01:00.001Z');
    expect(isOtpExpired(otp, now)).toBe(true);
  });
});
