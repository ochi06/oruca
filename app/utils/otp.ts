// docs/schema.md OTP_CODES に対応する型・ヘルパー。
// US-005：又聞き・一方的な操作での友達登録を防ぐため、対面等で直接
// コードを伝え合うことを前提にした60秒失効のワンタイムパスワード。
//
// コード自体の検証・FRIENDSHIPS作成は、他人のOTP_CODES行を読む必要がある
// （RLSをまたぐ）ため、Supabase側のRPC（redeem_friend_otp、Issue #143。
// supabase/migrations/20260930120000_friend_otp_redeem_rpc.sql参照）で行う。
// ここにはクライアント側でも安全に使える生成・期限判定のみを残す

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

// 失効時刻ちょうどは失効済み扱い（expires_at <= now）
export function isOtpExpired(otp: OtpCode, now: Date): boolean {
  return now.getTime() >= new Date(otp.expires_at).getTime();
}
