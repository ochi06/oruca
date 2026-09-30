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

// 友達ごとの入室通知ON/OFFを更新する（US-007、受信側＝自分の行を更新）
export async function updateFriendshipNotifyEnabled(
  userId: string,
  friendId: string,
  notifyEnabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ notify_enabled: notifyEnabled })
    .eq('user_id', userId)
    .eq('friend_id', friendId);
  if (error) {
    throw error;
  }
}

// 特定の友達をミュートする（US-008、受信側＝自分の行を更新）
export async function updateFriendshipMuted(
  userId: string,
  friendId: string,
  muted: boolean
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ muted })
    .eq('user_id', userId)
    .eq('friend_id', friendId);
  if (error) {
    throw error;
  }
}

// 共在時のみ入室通知を受け取るかどうか（US-016、受信側の設定）
export async function updateFriendshipNotifyOnlyWhenCopresent(
  userId: string,
  friendId: string,
  notifyOnlyWhenCopresent: boolean
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ notify_only_when_copresent: notifyOnlyWhenCopresent })
    .eq('user_id', userId)
    .eq('friend_id', friendId);
  if (error) {
    throw error;
  }
}

// 「会いたい人」に登録するかどうか（US-017、受信側の設定）
export async function updateFriendshipWantToMeet(
  userId: string,
  friendId: string,
  wantToMeet: boolean
): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ want_to_meet: wantToMeet })
    .eq('user_id', userId)
    .eq('friend_id', friendId);
  if (error) {
    throw error;
  }
}

// 自分宛の新しいOTPコードを発行する（US-005）。otp_codesは自分の行のみ
// insert可能なRLSのため、クライアントから直接insertしてよい
export async function issueMyOtp(userId: string): Promise<OtpCode> {
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
  if (error) {
    throw error;
  }
  return data as OtpCode;
}

export type RedeemOtpResult =
  | { status: 'success'; friendId: string; friendName: string }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'self' };

// 相手が見せたOTPコードを検証し、FRIENDSHIPSを作成する（US-005）。
// RLSをまたぐ処理のためSupabase側のRPC（redeem_friend_otp、SECURITY DEFINER）
// を呼ぶ（supabase/migrations/20260930120000_friend_otp_redeem_rpc.sql参照）
export async function redeemOtp(code: string): Promise<RedeemOtpResult> {
  const { data, error } = await supabase.rpc('redeem_friend_otp', { p_code: code });
  if (error) {
    throw error;
  }

  const status = data?.status as RedeemOtpResult['status'] | undefined;
  if (status === 'success') {
    return { status: 'success', friendId: data.friend_id as string, friendName: data.friend_name as string };
  }
  if (status === 'expired' || status === 'not_found' || status === 'self') {
    return { status };
  }
  throw new Error('友達追加の検証に失敗しました');
}
