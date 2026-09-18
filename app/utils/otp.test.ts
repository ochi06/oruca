import {
  generateOtpCode,
  issueOtp,
  isOtpExpired,
  verifyOtp,
  OTP_CODE_LENGTH,
  OTP_TTL_MS,
} from './otp';

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

describe('issueOtp', () => {
  test('userIdに紐づくOTPを、発行から60秒後に失効する形で生成する', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');
    const otp = issueOtp('user-a', now);

    expect(otp.user_id).toBe('user-a');
    expect(otp.created_at).toBe(now.toISOString());
    expect(otp.expires_at).toBe(new Date(now.getTime() + OTP_TTL_MS).toISOString());
  });
});

describe('isOtpExpired', () => {
  const otp = issueOtp('user-a', new Date('2026-08-16T00:00:00.000Z'));

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

describe('verifyOtp', () => {
  const now = new Date('2026-08-16T00:00:00.000Z');
  const otp = issueOtp('user-a', now);

  test('一致するコードが有効期限内なら valid を返す', () => {
    const result = verifyOtp(otp.code, [otp], new Date(now.getTime() + 1000));
    expect(result).toEqual({ status: 'valid', otp });
  });

  test('一致するコードが失効していれば expired を返す', () => {
    const result = verifyOtp(otp.code, [otp], new Date(now.getTime() + OTP_TTL_MS));
    expect(result).toEqual({ status: 'expired' });
  });

  test('一致するコードが無ければ not_found を返す', () => {
    const result = verifyOtp('999999', [otp], now);
    expect(result).toEqual({ status: 'not_found' });
  });
});
