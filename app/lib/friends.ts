import { supabase } from './supabase';
import { Friendship, User } from '../mocks/presence';
import { generateOtpCode, OtpCode, OTP_TTL_MS } from '../utils/otp';

// 自分（user_id = userId）を起点とするFRIENDSHIPS行を取得する（Issue #143）。
// 受信側の設定（notify_enabled/muted等）は自分の行にしか無いため、
// friend_id側の行は取得しない（docs/schema.md「FRIENDSHIPS」参照）
export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await supabase.from('friendships').select('*').eq('user_id', userId);
  if (error) {
    throw error;
  }
  return (data ?? []) as Friendship[];
}

// friendIdsに対応するUSERS行を取得する（一覧表示用の名前・アイコン）
export async function fetchUsersByIds(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase.from('users').select('*').in('id', userIds);
  if (error) {
    throw error;
  }
  return (data ?? []) as User[];
}

// friendshipsの真偽値カラム1つを更新する共通ヘルパー（Issue #147）。
// notify_enabled（US-007）・muted（US-008）・want_to_meet（US-017）・
// location_hidden（Issue #121）はいずれも「自分の行（user_id=userId）の
// 1カラムをtoggleする」という形が同じため、フィールド名だけを差し替えて
// 共通化した（notify_only_when_copresentはIssue #270で廃止）
export async function updateFriendshipField(
  userId: string,
  friendId: string,
  field: 'notify_enabled' | 'muted' | 'want_to_meet' | 'location_hidden',
  value: boolean
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ [field]: value })
    .eq('user_id', userId)
    .eq('friend_id', friendId);
  if (error) {
    throw error;
  }
}

// 友達関係を双方向に解消する（US-008「削除」、Issue #276）。FRIENDSHIPSは
// 片方向2行構成のため、クライアントから自分の行だけをDELETEしても相手の行が
// 残ってしまう。transferOwnership（lib/groups.ts）と同様のSECURITY DEFINER
// RPC（remove_friendship）で両方の行を一括・物理削除する
// （supabase/migrations/20261002180000_remove_friendship.sql参照）。
// ソフトデリートではなく物理削除のため、再度友達になるには通常のOTP追加
// フローが必要（2026-10-02、開発者確認済み）
export async function removeFriendship(friendId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friendship', { p_friend_id: friendId });
  if (error) {
    throw error;
  }
}

// 未失効のコード同士はDBレベルでユニーク（supabase/migrations/
// 20261001120000_friend_otp_redeem_fix.sql、otp_codes_code_active_idx）。
// 衝突した場合のPostgresのunique violationエラーコード
const UNIQUE_VIOLATION = '23505';
const ISSUE_OTP_MAX_ATTEMPTS = 5;

// 自分宛の新しいOTPコードを発行する（US-005）。otp_codesは自分の行のみ
// insert可能なRLSのため、クライアントから直接insertしてよい。
// 生成した6桁コードが、同時刻に他の誰かが持つ未失効のコードと衝突した場合
// （Issue #147）はDB側でinsertが失敗するため、別のコードで振り直す
export async function issueMyOtp(userId: string): Promise<OtpCode> {
  for (let attempt = 0; attempt < ISSUE_OTP_MAX_ATTEMPTS; attempt++) {
    const now = new Date();
    const code = generateOtpCode();

    const { data, error } = await supabase
      .from('otp_codes')
      .insert({
        user_id: userId,
        code,
        expires_at: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
      })
      .select('*')
      .single();

    if (!error) {
      return data as OtpCode;
    }
    if (error.code !== UNIQUE_VIOLATION) {
      throw error;
    }
    // 衝突（ごく稀）。次のループで別のコードを生成して再試行する
  }
  throw new Error('OTPコードの発行に失敗しました。もう一度お試しください');
}

export type RedeemOtpResult =
  | { status: 'success'; friendId: string; friendName: string }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'self' }
  // 匿名セッションからの呼び出し（Issue #151でクローズ機能から締め出された
  // 匿名アカウント）。RLSをバイパスするSECURITY DEFINER関数のため、
  // RPC本体で明示チェックしている（Issue #200）
  | { status: 'forbidden' }
  // 直近60秒間の失敗試行が規定回数を超えた場合（Issue #339、ブルートフォース対策）
  | { status: 'rate_limited' };

// 相手が見せたOTPコードを検証し、FRIENDSHIPSを作成する（US-005）。
// RLSをまたぐ処理のためSupabase側のRPC（redeem_friend_otp、SECURITY DEFINER）
// を呼ぶ（supabase/migrations/20261002091500_redeem_friend_otp_reject_anonymous.sql参照）
export async function redeemOtp(code: string): Promise<RedeemOtpResult> {
  const { data, error } = await supabase.rpc('redeem_friend_otp', { p_code: code });
  if (error) {
    throw error;
  }

  const status = data?.status as RedeemOtpResult['status'] | undefined;
  if (status === 'success') {
    return { status: 'success', friendId: data.friend_id as string, friendName: data.friend_name as string };
  }
  if (
    status === 'expired' ||
    status === 'not_found' ||
    status === 'self' ||
    status === 'forbidden' ||
    status === 'rate_limited'
  ) {
    return { status };
  }
  throw new Error('友達追加の検証に失敗しました');
}
