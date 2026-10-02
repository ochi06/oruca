import { isWantToMeetLimitError, useNotifyPreferencesStore } from './useNotifyPreferencesStore';
import * as friendsApi from '../lib/friends';
import { Friendship } from '../mocks/presence';

// Issue #330: toggleWantToMeetが5人上限超過（DBトリガー起因）で失敗した時、
// 楽観的更新を元に戻した上でエラーを呼び出し側に伝える（rethrow）ことを
// 検証する。lib/friends.tsのSupabase呼び出しはモックする
jest.mock('../lib/friends');

const mockedFriendsApi = friendsApi as jest.Mocked<typeof friendsApi>;

const NOW = '2026-10-02T00:00:00.000Z';
const CURRENT_USER_ID = 'user-me';

function makeFriendship(overrides: Partial<Friendship> = {}): Friendship {
  return {
    id: 'friendship-1',
    user_id: CURRENT_USER_ID,
    friend_id: 'user-friend',
    notify_enabled: true,
    muted: false,
    want_to_meet: false,
    location_hidden: false,
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('isWantToMeetLimitError', () => {
  it('DBトリガーの上限超過エラーはtrue', () => {
    expect(isWantToMeetLimitError({ message: 'want_to_meet limit reached (max 5)' })).toBe(true);
  });

  it('無関係なエラーはfalse', () => {
    expect(isWantToMeetLimitError({ message: 'Network request failed' })).toBe(false);
  });

  it('nullはfalse', () => {
    expect(isWantToMeetLimitError(null)).toBe(false);
  });

  it('messageプロパティの無いオブジェクトはfalse', () => {
    expect(isWantToMeetLimitError({ code: '23505' })).toBe(false);
  });
});

describe('toggleWantToMeet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotifyPreferencesStore.setState({
      currentUserId: CURRENT_USER_ID,
      friendships: [makeFriendship({ want_to_meet: false })],
      users: [],
      status: 'ready',
      errorMessage: null,
    });
  });

  it('成功時は楽観的更新がそのまま残る', async () => {
    mockedFriendsApi.updateFriendshipField.mockResolvedValue(undefined);

    await useNotifyPreferencesStore.getState().toggleWantToMeet('user-friend');

    expect(useNotifyPreferencesStore.getState().friendships[0].want_to_meet).toBe(true);
    expect(mockedFriendsApi.updateFriendshipField).toHaveBeenCalledWith(
      CURRENT_USER_ID,
      'user-friend',
      'want_to_meet',
      true
    );
  });

  it('5人上限超過（DBトリガー）で失敗した場合、楽観的更新を元に戻しつつエラーを投げ直す', async () => {
    const limitError = { message: 'want_to_meet limit reached (max 5)' };
    mockedFriendsApi.updateFriendshipField.mockRejectedValue(limitError);

    await expect(
      useNotifyPreferencesStore.getState().toggleWantToMeet('user-friend')
    ).rejects.toEqual(limitError);

    // 一度trueに楽観更新された後、失敗を受けてfalseに戻っていること
    expect(useNotifyPreferencesStore.getState().friendships[0].want_to_meet).toBe(false);
  });
});

describe('toggleLocationHidden', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotifyPreferencesStore.setState({
      currentUserId: CURRENT_USER_ID,
      friendships: [makeFriendship({ location_hidden: false })],
      users: [],
      status: 'ready',
      errorMessage: null,
    });
  });

  it('失敗した場合、楽観的更新を元に戻し、エラーは投げ直さない（黙って戻すだけ）', async () => {
    mockedFriendsApi.updateFriendshipField.mockRejectedValue(new Error('network error'));

    await expect(
      useNotifyPreferencesStore.getState().toggleLocationHidden('user-friend')
    ).resolves.toBeUndefined();

    expect(useNotifyPreferencesStore.getState().friendships[0].location_hidden).toBe(false);
  });
});
