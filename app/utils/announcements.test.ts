import { isAnnouncementUnread } from './announcements';
import { Announcement } from '../mocks/announcements';

function announcement(id: string, createdAt: string): Announcement {
  return { id, message: `お知らせ${id}`, created_at: createdAt };
}

describe('isAnnouncementUnread', () => {
  const announcements: Announcement[] = [
    announcement('new', '2026-10-03T00:00:00.000Z'),
    announcement('middle', '2026-10-02T00:00:00.000Z'),
    announcement('old', '2026-10-01T00:00:00.000Z'),
  ];

  it('lastSeenIdがnullなら全て未読扱いにする', () => {
    expect(isAnnouncementUnread(announcements[0], announcements, null)).toBe(true);
    expect(isAnnouncementUnread(announcements[2], announcements, null)).toBe(true);
  });

  it('lastSeenIdより新しいお知らせは未読', () => {
    expect(isAnnouncementUnread(announcements[0], announcements, 'middle')).toBe(true);
  });

  it('lastSeenId自身は既読扱い', () => {
    expect(isAnnouncementUnread(announcements[1], announcements, 'middle')).toBe(false);
  });

  it('lastSeenIdより古いお知らせは既読', () => {
    expect(isAnnouncementUnread(announcements[2], announcements, 'middle')).toBe(false);
  });

  it('lastSeenIdが現在の一覧に見つからない場合は未読扱いにする', () => {
    expect(isAnnouncementUnread(announcements[0], announcements, 'deleted-id')).toBe(true);
  });
});
