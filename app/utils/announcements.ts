import { Announcement } from '../mocks/announcements';

// Issue #422: お知らせの既読管理はDBで持たず、「最後に見たお知らせのid」だけを
// 端末ローカル（AsyncStorage）に保持する簡易方式。あるお知らせが未読かどうかは、
// lastSeenIdに対応するお知らせのcreated_atより新しいかどうかで判定する
// （idはuuidで大小比較に意味が無いため、created_atの比較に変換する）。
// lastSeenIdがnull、またはannouncements内に見つからない（削除された等）場合は
// 安全側に倒して未読扱いにする
export function isAnnouncementUnread(
  announcement: Announcement,
  announcements: Announcement[],
  lastSeenId: string | null
): boolean {
  if (lastSeenId === null) return true;
  const lastSeen = announcements.find((a) => a.id === lastSeenId);
  if (!lastSeen) return true;
  return announcement.created_at > lastSeen.created_at;
}
