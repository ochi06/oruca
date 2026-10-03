import { create } from 'zustand';

import { ensureSignedIn } from '../lib/auth';
import { issueMyOtp, redeemOtp } from '../lib/friends';
import { useNotifyPreferencesStore } from './useNotifyPreferencesStore';
import { isOtpExpired, OtpCode } from '../utils/otp';
import { isNetworkError } from '../utils/network';

export type AddFriendResult =
  | { status: 'success'; friendName: string }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'self' }
  | { status: 'forbidden' }
  // 直近60秒間の失敗試行が規定回数を超えた場合（Issue #339、ブルートフォース対策）
  | { status: 'rate_limited' }
  // isNetworkErrorは「入力されたコードの誤り」と区別し、呼び出し側で
  // 再試行を促す案内を出し分けるために使う（Issue #314）
  | { status: 'error'; isNetworkError: boolean };

type FriendAddState = {
  myOtp: OtpCode | null;
  isIssuingOtp: boolean;
  refreshMyOtpIfExpired: () => Promise<void>;
  verifyCode: (inputCode: string) => Promise<AddFriendResult>;
};

export const useFriendAddStore = create<FriendAddState>((set, get) => ({
  myOtp: null,
  isIssuingOtp: false,

  refreshMyOtpIfExpired: async () => {
    const { myOtp, isIssuingOtp } = get();
    if (isIssuingOtp || (myOtp && !isOtpExpired(myOtp, new Date()))) {
      return;
    }
    set({ isIssuingOtp: true });
    try {
      const userId = await ensureSignedIn();
      const otp = await issueMyOtp(userId);
      set({ myOtp: otp });
    } catch (error) {
      // Issue #339：短時間に大量発行しようとした場合、DB側のトリガーが
      // insert自体を拒否する（想定内の挙動）。通常利用では60秒TTLごとに
      // 1回しか発行しないため到達しない想定。myOtpは更新せず、次回の
      // タイマー（1秒間隔、AddFriendScreen.tsx）で再試行されるのに任せる
      console.error('issueMyOtp failed:', error);
    } finally {
      set({ isIssuingOtp: false });
    }
  },

  verifyCode: async (inputCode) => {
    try {
      const result = await redeemOtp(inputCode);
      if (result.status === 'success') {
        // 友達一覧に即反映させる（Issue #143）
        await useNotifyPreferencesStore.getState().initialize();
        return { status: 'success', friendName: result.friendName };
      }
      return { status: result.status };
    } catch (error) {
      return { status: 'error', isNetworkError: isNetworkError(error) };
    }
  },
}));
