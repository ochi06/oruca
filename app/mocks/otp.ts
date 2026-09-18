// US-005の友達追加フローを動作確認するためのモックデータ。
// 「まだ友達になっていない相手」が、対面でOTP（QR/コード）を見せている
// 状況を1台の端末上で再現する（app/mocks/presence.ts と同じ方針）。

import { User } from './presence';
import { OtpCode } from '../utils/otp';

export const otherUser: User = {
  id: 'user-d',
  name: '高橋',
  icon_url: null,
  created_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
};

// 動作確認用に、常に有効なOTP（発行から60秒経っていない）としてシードする
export function seedOtherUserOtp(now: Date): OtpCode {
  return {
    id: `otp-${otherUser.id}-seed`,
    user_id: otherUser.id,
    code: '123456',
    expires_at: new Date(now.getTime() + 60_000).toISOString(),
    created_at: now.toISOString(),
  };
}
