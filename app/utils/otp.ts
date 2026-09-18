// docs/schema.md OTP_CODES に対応するOTP生成・検証ロジック。
// US-005：又聞き・一方的な操作での友達登録を防ぐため、対面等で直接
// コードを伝え合うことを前提にした60秒失効のワンタイムパスワード。
//
// 本来はEdge Functions側で行うべき処理（docs/architecture.md
// 「実装方針」参照。クライアントに置くと改ざん・実装ばらつきのリスクが
// あるため）だが、現段階はモックデータで画面を動かす方針のため、
// バックエンド接続後にこの関数群をEdge Functions呼び出しに置き換える想定。

export type OtpCode = {
  id: string;
  user_id: string;
  code: string;
  expires_at: string; // ISO 8601
  created_at: string; // ISO 8601
};

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 60_000;

// 0埋め6桁の数字コードを生成する
export function generateOtpCode(): string {
  const value = Math.floor(Math.random() * 10 ** OTP_CODE_LENGTH);
  return value.toString().padStart(OTP_CODE_LENGTH, '0');
}

// userIdに対する新しいOTPを発行する（60秒後に失効）
export function issueOtp(userId: string, now: Date): OtpCode {
  const nowIso = now.toISOString();
  return {
    id: `otp-${userId}-${now.getTime()}`,
    user_id: userId,
    code: generateOtpCode(),
    expires_at: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
    created_at: nowIso,
  };
}

// 失効時刻ちょうどは失効済み扱い（expires_at <= now）
export function isOtpExpired(otp: OtpCode, now: Date): boolean {
  return now.getTime() >= new Date(otp.expires_at).getTime();
}

export type VerifyOtpResult =
  | { status: 'valid'; otp: OtpCode }
  | { status: 'expired' }
  | { status: 'not_found' };

// 入力コードに一致し、かつ失効していないOTPを探す。
// codeだけでなくuser_idも突き合わせたい場合は呼び出し側でotp.user_idを確認する
export function verifyOtp(
  inputCode: string,
  otps: OtpCode[],
  now: Date
): VerifyOtpResult {
  const match = otps.find((otp) => otp.code === inputCode);
  if (match === undefined) {
    return { status: 'not_found' };
  }
  if (isOtpExpired(match, now)) {
    return { status: 'expired' };
  }
  return { status: 'valid', otp: match };
}
