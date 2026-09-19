import { shouldSendEntryNotification } from './notifications';
import { Friendship } from '../mocks/presence';

const now = '2026-08-16T00:00:00.000Z';

function makeFriendship(overrides: Partial<Friendship> = {}): Friendship {
  return {
    id: 'friendship-a',
    user_id: 'user-me',
    friend_id: 'user-a',
    notify_enabled: true,
    muted: false,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('shouldSendEntryNotification', () => {
  test('notify_enabledがtrueなら通知してよいと判定する', () => {
    expect(shouldSendEntryNotification(makeFriendship({ notify_enabled: true }))).toBe(true);
  });

  test('notify_enabledがfalseなら通知しないと判定する', () => {
    expect(shouldSendEntryNotification(makeFriendship({ notify_enabled: false }))).toBe(false);
  });
});
