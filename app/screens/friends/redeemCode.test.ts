import { redeemCode, RedeemCodeDeps } from './redeemCode';

// Issue #315: RedeemCodeScreen.tsxのグループ招待コード→友達OTPのフォールバック
// 判別ロジック（グループ招待コードとして検索し、not_foundなら友達OTPとして
// 検証する）のテスト。store側の処理はdeps経由でモックする
function makeDeps(overrides: Partial<RedeemCodeDeps> = {}): RedeemCodeDeps {
  return {
    joinOpenGroupByInviteCode: jest.fn().mockResolvedValue({ status: 'not_found' }),
    verifyFriendCode: jest.fn().mockResolvedValue({ status: 'not_found' }),
    ...overrides,
  };
}

describe('redeemCode', () => {
  test('正しいグループ招待コードで参加に成功する', async () => {
    const deps = makeDeps({
      joinOpenGroupByInviteCode: jest
        .fn()
        .mockResolvedValue({ status: 'success', groupId: 'group-1', groupName: 'テストグループ', memberId: 'member-1' }),
    });

    const result = await redeemCode('ABC123', 'user-1', deps);

    expect(result).toEqual({ source: 'group', status: 'success', groupName: 'テストグループ', memberId: 'member-1' });
    expect(deps.verifyFriendCode).not.toHaveBeenCalled();
  });

  test('既にグループのメンバーの場合はalready_memberを返し、友達OTPは試さない', async () => {
    const deps = makeDeps({
      joinOpenGroupByInviteCode: jest.fn().mockResolvedValue({ status: 'already_member' }),
    });

    const result = await redeemCode('ABC123', 'user-1', deps);

    expect(result).toEqual({ source: 'group', status: 'already_member' });
    expect(deps.verifyFriendCode).not.toHaveBeenCalled();
  });

  // 期限切れ・closedグループのコード・存在しないコードは、いずれも
  // joinOpenGroupByInviteCode側でnot_foundに正規化される（store/useGroupStore.test.ts
  // 参照）。redeemCode側はそれを受けて友達OTPとしての検証にフォールバックする
  test('グループの招待コードとして見つからない場合、友達OTPとして検証しその結果を返す', async () => {
    const deps = makeDeps({
      joinOpenGroupByInviteCode: jest.fn().mockResolvedValue({ status: 'not_found' }),
      verifyFriendCode: jest.fn().mockResolvedValue({ status: 'success', friendName: '田中' }),
    });

    const result = await redeemCode('123456', 'user-1', deps);

    expect(result).toEqual({ source: 'friend', status: 'success', friendName: '田中' });
  });

  test('グループ・友達のどちらのコードとしても見つからない場合はnot_foundを返す', async () => {
    const deps = makeDeps();

    const result = await redeemCode('ZZZZZZ', 'user-1', deps);

    expect(result).toEqual({ status: 'not_found' });
  });

  test.each([['expired'], ['self'], ['forbidden']] as const)(
    '友達OTPが%sの場合はそのままsourceを付けて返す',
    async (status) => {
      const deps = makeDeps({
        verifyFriendCode: jest.fn().mockResolvedValue({ status }),
      });

      const result = await redeemCode('123456', 'user-1', deps);

      expect(result).toEqual({ source: 'friend', status });
    }
  );

  test('joinOpenGroupByInviteCodeが例外を投げた場合はerrorを返し、友達OTPは試さない', async () => {
    const deps = makeDeps({
      joinOpenGroupByInviteCode: jest.fn().mockRejectedValue(new Error('network error')),
    });

    const result = await redeemCode('ABC123', 'user-1', deps);

    expect(result).toEqual({ status: 'error' });
    expect(deps.verifyFriendCode).not.toHaveBeenCalled();
  });

  test('友達OTPの検証がerrorの場合はerrorを返す', async () => {
    const deps = makeDeps({
      verifyFriendCode: jest.fn().mockResolvedValue({ status: 'error' }),
    });

    const result = await redeemCode('123456', 'user-1', deps);

    expect(result).toEqual({ status: 'error' });
  });

  // 匿名セッション（Issue #151のsignInAnonymously経由）のuserIdも、通常ユーザーと
  // 同じ文字列としてそのままdeps.joinOpenGroupByInviteCodeに渡される。
  // 匿名/通常の区別はこの関数では行わないことを確認する
  test('匿名セッションのuserIdでも通常ユーザーと同じ経路で参加できる', async () => {
    const anonymousUserId = 'anon-session-user-id';
    const joinOpenGroupByInviteCode = jest
      .fn()
      .mockResolvedValue({ status: 'success', groupId: 'group-1', groupName: 'テストグループ', memberId: 'member-anon' });
    const deps = makeDeps({ joinOpenGroupByInviteCode });

    const result = await redeemCode('ABC123', anonymousUserId, deps);

    expect(result).toEqual({ source: 'group', status: 'success', groupName: 'テストグループ', memberId: 'member-anon' });
    expect(joinOpenGroupByInviteCode).toHaveBeenCalledWith('ABC123', anonymousUserId);
  });
});
