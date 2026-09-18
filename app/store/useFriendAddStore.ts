import { create } from 'zustand';

import { CURRENT_USER_ID } from '../mocks/presence';
import { otherUser, seedOtherUserOtp } from '../mocks/otp';
import { issueOtp, isOtpExpired, verifyOtp, OtpCode } from '../utils/otp';

export type AddFriendResult =
  | { status: 'success'; friendName: string }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'self' };

type FriendAddState = {
  myOtp: OtpCode;
  issuedOtps: OtpCode[];
  addedFriendIds: string[];
  refreshMyOtpIfExpired: () => void;
  verifyCode: (inputCode: string) => AddFriendResult;
};

export const useFriendAddStore = create<FriendAddState>((set, get) => ({
  myOtp: issueOtp(CURRENT_USER_ID, new Date()),
  issuedOtps: [seedOtherUserOtp(new Date())],
  addedFriendIds: [],

  refreshMyOtpIfExpired: () => {
    const now = new Date();
    const { myOtp } = get();
    if (isOtpExpired(myOtp, now)) {
      set({ myOtp: issueOtp(CURRENT_USER_ID, now) });
    }
  },

  verifyCode: (inputCode) => {
    const now = new Date();
    const { myOtp, issuedOtps } = get();

    if (inputCode === myOtp.code) {
      return { status: 'self' };
    }

    const result = verifyOtp(inputCode, issuedOtps, now);
    if (result.status !== 'valid') {
      return { status: result.status };
    }

    const friend = result.otp.user_id === otherUser.id ? otherUser : null;
    if (friend === null) {
      return { status: 'not_found' };
    }

    set((state) => ({
      addedFriendIds: state.addedFriendIds.includes(friend.id)
        ? state.addedFriendIds
        : [...state.addedFriendIds, friend.id],
    }));
    return { status: 'success', friendName: friend.name };
  },
}));
