import { mockUsers } from '../mocks/presence';
import { GroupMember } from '../mocks/groups';

// 複数の画面（グループ詳細・招待一覧・通知ボックス等）で同じ形の
// user_id→表示名解決が必要なため共通化した
export function findUserName(userId: string): string {
  return mockUsers.find((user) => user.id === userId)?.name ?? '不明なユーザー';
}

// GROUP_MEMBERS.display_name/display_icon_urlが設定されていれば優先し、
// 未設定ならUSERS側の値にフォールバックする（Issue #150、グループ内限定の
// 表示名・アイコン上書き）
export function resolveGroupMemberDisplay(
  member: Pick<GroupMember, 'display_name' | 'display_icon_url'>,
  fallback: { name: string; iconUrl: string | null }
): { name: string; iconUrl: string | null } {
  return {
    name: member.display_name ?? fallback.name,
    iconUrl: member.display_icon_url ?? fallback.iconUrl,
  };
}
