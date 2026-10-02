import { JoinOpenGroupResult } from '../../store/useGroupStore';
import { AddFriendResult } from '../../store/useFriendAddStore';

export type RedeemResult =
  | { source: 'group'; status: 'success'; groupName: string; memberId: string }
  | { source: 'group'; status: 'already_member' }
  | { source: 'friend'; status: 'success'; friendName: string }
  | { source: 'friend'; status: 'expired' }
  | { source: 'friend'; status: 'self' }
  // 匿名セッションからの友達追加は拒否される（Issue #200）
  | { source: 'friend'; status: 'forbidden' }
  | { status: 'not_found' }
  | { status: 'error' };

export type RedeemCodeDeps = {
  joinOpenGroupByInviteCode: (inviteCode: string, userId: string) => Promise<JoinOpenGroupResult>;
  verifyFriendCode: (inputCode: string) => Promise<AddFriendResult>;
};

// RedeemCodeScreen（Issue #208）が「相手から渡されたコードを読み取る/入力する」
// 1画面で、グループの招待コード（英数字6桁）・友達追加のOTP（数字6桁）の
// どちらも受け付けるための判別ロジック。文字種が完全に排他ではないため
// フォーマットでの事前判別はせず、まずグループ招待コードとして検索し、
// 見つからなければ（not_found）友達OTPとして検証する順でバックエンド判別する。
//
// signedInUserIdには匿名セッション（Issue #151のsignInAnonymously）のuserIdも
// そのまま渡せる。匿名／通常ユーザーの区別はこの関数では行わず、オープン
// グループ参加の可否はRLS側（supabase/migrations/20261001170000_anonymous_
// open_group_join.sql）で強制される
export async function redeemCode(
  trimmedCode: string,
  signedInUserId: string,
  deps: RedeemCodeDeps
): Promise<RedeemResult> {
  try {
    const groupResult = await deps.joinOpenGroupByInviteCode(trimmedCode, signedInUserId);
    if (groupResult.status === 'success') {
      return {
        source: 'group',
        status: 'success',
        groupName: groupResult.groupName,
        memberId: groupResult.memberId,
      };
    }
    if (groupResult.status === 'already_member') {
      return { source: 'group', status: 'already_member' };
    }
    // not_found → グループの招待コードではなかったので、友達OTPとして試す
  } catch {
    return { status: 'error' };
  }

  const friendResult = await deps.verifyFriendCode(trimmedCode);
  if (friendResult.status === 'success') {
    return { source: 'friend', status: 'success', friendName: friendResult.friendName };
  }
  if (friendResult.status === 'expired' || friendResult.status === 'self' || friendResult.status === 'forbidden') {
    return { source: 'friend', status: friendResult.status };
  }
  if (friendResult.status === 'error') {
    return { status: 'error' };
  }
  return { status: 'not_found' };
}
