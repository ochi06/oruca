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
    want_to_meet: false,
    location_hidden: false,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('shouldSendEntryNotification', () => {
  test('notify_enabledがtrueで共在していれば通知してよいと判定する', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: true }), true, true, false)
    ).toBe(true);
  });

  test('notify_enabledがfalseなら、共在していても通知しないと判定する', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: false }), true, true, false)
    ).toBe(false);
  });

  test('notify_enabledがtrueでもmutedがtrueなら通知しないと判定する（Issue #8、mutedが優先）', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: true, muted: true }), true, true, false)
    ).toBe(false);
  });

  test('notify_enabledがfalseでmutedもtrueなら通知しないと判定する', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: false, muted: true }), true, true, false)
    ).toBe(false);
  });

  test('Issue #270：共在時のみ通知は個別トグルではなく常時適用のルールになったため、want_to_meetがfalseでも共在していれば通知する', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: false }), true, true, false)
    ).toBe(true);
  });

  test('共在しておらずwant_to_meetもfalseなら通知しない', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: false }), false, true, false)
    ).toBe(false);
  });

  test('US-017：want_to_meetがtrueで、共在していなくても入室した本人がallow_entry_notifications=trueなら通知する', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: true }), false, true, false)
    ).toBe(true);
  });

  test('US-017：want_to_meetがtrueでも、共在しておらず入室した本人がallow_entry_notifications=falseなら通知しない', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: true }), false, false, false)
    ).toBe(false);
  });

  test('want_to_meetがtrueで共在中なら、allow_entry_notificationsがfalseでも通知する（共在ルールが優先）', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: true }), true, false, false)
    ).toBe(true);
  });

  test('want_to_meetがtrueで共在中でも、mutedがtrueなら通知しない（mutedが優先）', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: true, muted: true }), true, true, false)
    ).toBe(false);
  });

  // Issue #352：入室した本人が匿名モード中（USERS.is_anonymous=true）の場合、
  // 他の条件がすべて通知を許可する状態であっても、誰にも通知してはいけない
  test('入室した本人が匿名モード中なら、共在していても通知しない', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: true, muted: false }), true, true, true)
    ).toBe(false);
  });

  test('入室した本人が匿名モード中なら、want_to_meetかつallow_entry_notifications=trueでも通知しない', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ want_to_meet: true }), false, true, true)
    ).toBe(false);
  });

  test('入室した本人が匿名モード中でなければ、従来通り判定する（回帰防止）', () => {
    expect(
      shouldSendEntryNotification(makeFriendship({ notify_enabled: true, muted: false }), true, true, false)
    ).toBe(true);
  });
});
