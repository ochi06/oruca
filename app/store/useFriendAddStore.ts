import { create } from 'zustand';

import { ensureSignedIn } from '../lib/auth';
import { issueMyOtp, redeemOtp } from '../lib/friends';
import { useNotifyPreferencesStore } from './useNotifyPreferencesStore';
import { isOtpExpired, OtpCode } from '../utils/otp';

export type AddFriendResult =
  | { status: 'success'; friendName: string }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'self' }
  | { status: 'forbidden' }
  | { status: 'error' };

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
    } catch {
      return { status: 'error' };
    }
  },
}));
