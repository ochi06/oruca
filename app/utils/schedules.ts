// Issue #367（US-011方針転換、2026-10-03）：滞在予定・ひとことメッセージの
// 可視性は、エリア単位のFRIEND_AREA_LINKS承認ではなく、USERSの行全体に
// 適用される既存RLS（FRIENDSHIPS.status = 'active'の相手に公開）に一本化した。
// そのため、呼び出し側（useFriendUsers等）が既にRLS経由で取得したUser一覧を
// そのまま渡せばよく、可視性判定ロジック自体がここには残らない

import { User } from '../mocks/presence';

// 友達一覧・詳細画面のアイコン表示用（Issue #274、#367で判定元をUSERSの
// schedule_note/status_messageに変更）。空文字（保存はされているが
// 未入力扱い）は「設定あり」に含めない
export function friendIdsWithVisibleNotes(
  users: Pick<User, 'id' | 'schedule_note' | 'status_message'>[]
): Set<string> {
  const ids = new Set<string>();
  for (const user of users) {
    const hasScheduleNote = (user.schedule_note ?? '').trim().length > 0;
    const hasStatusMessage = (user.status_message ?? '').trim().length > 0;
    if (hasScheduleNote || hasStatusMessage) {
      ids.add(user.id);
    }
  }
  return ids;
}
