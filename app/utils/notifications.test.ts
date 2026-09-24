import { shouldSendEntryNotification, shouldSendWantToMeetNotification } from './notifications';
import { Friendship } from '../mocks/presence';

const now = '2026-08-16T00:00:00.000Z';

function makeFriendship(overrides: Partial<Friendship> = {}): Friendship {
  return {
    id: 'friendship-a',
    user_id: 'user-me',
    friend_id: 'user-a',
    notify_enabled: true,
    muted: false,
    notify_only_when_copresent: false,
    want_to_meet: false,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('shouldSendEntryNotification', () => {
  test('notify_enabledがtrueなら通知してよいと判定する', () => {
    expect(shouldSendEntryNotification(makeFriendship({ notify_enabled: true }), false)).toBe(true);
  });

  test('notify_enabledがfalseなら通知しないと判定する', () => {
    expect(shouldSendEntryNotification(makeFriendship({ notify_enabled: false }), false)).toBe(false);
  });

  test('notify_enabledがtrueでもmutedがtrueなら通知しないと判定する（Issue #8、mutedが優先）', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: true, muted: true }), false)
    ).toBe(false);
  });

  test('notify_enabledがfalseでmutedもtrueなら通知しないと判定する', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: false, muted: true }), false)
    ).toBe(false);
  });

  test('US-016：notify_only_when_copresentがtrueで、受信者が同じエリアに在席していなければ通知しない', () => {
    expect(
      shouldSendEntryNotification(
        makeFriendship({ notify_only_when_copresent: true }),
        false
      )
    ).toBe(false);
  });

  test('US-016：notify_only_when_copresentがtrueでも、受信者が同じエリアに在席していれば通知する', () => {
    expect(
      shouldSendEntryNotification(
        makeFriendship({ notify_only_when_copresent: true }),
        true
      )
    ).toBe(true);
  });

  test('US-016：notify_only_when_copresentがfalseなら、在席していなくても通知する（従来通り）', () => {
    expect(
      shouldSendEntryNotification(
        makeFriendship({ notify_only_when_copresent: false }),
        false
      )
    ).toBe(true);
  });

  test('US-016：notify_only_when_copresentがtrueで在席中でも、mutedがtrueなら通知しない（mutedが優先）', () => {
    expect(
      shouldSendEntryNotification(
        makeFriendship({ notify_only_when_copresent: true, muted: true }),
        true
      )
    ).toBe(false);
  });
});

describe('shouldSendWantToMeetNotification', () => {
  test('want_to_meetがtrueで、入室した本人がallow_entry_notifications=trueなら通知する', () => {
    expect(shouldSendWantToMeetNotification(makeFriendship({ want_to_meet: true }), true)).toBe(true);
  });

  test('want_to_meetがtrueでも、入室した本人がallow_entry_notifications=falseなら通知しない', () => {
    expect(shouldSendWantToMeetNotification(makeFriendship({ want_to_meet: true }), false)).toBe(false);
  });

  test('want_to_meetがfalseなら、allow_entry_notificationsがtrueでも通知しない', () => {
    expect(shouldSendWantToMeetNotification(makeFriendship({ want_to_meet: false }), true)).toBe(false);
  });

  test('want_to_meetがtrueでも、mutedがtrueなら通知しない（mutedが優先）', () => {
    expect(
      shouldSendWantToMeetNotification(makeFriendship({ want_to_meet: true, muted: true }), true)
    ).toBe(false);
  });

  test('共在していなくても（notify_only_when_copresentの制限とは無関係に）通知できる', () => {
    expect(
      shouldSendWantToMeetNotification(
        makeFriendship({ want_to_meet: true, notify_only_when_copresent: true }),
        true
      )
    ).toBe(true);
  });
});
