import { GroupMember } from '../mocks/groups';

// 複数の画面（グループ詳細・招待一覧・通知ボックス等）で同じ形の
// user_id→表示名解決が必要なため共通化した。呼び出し側がlib/auth.tsの
// fetchUserNames()でまとめて取得したMapを渡す（Issue #214：以前はmocks/
// presence.tsの固定配列を参照しており、実アカウントの名前が常に
// 「不明なユーザー」になっていた）
export function resolveUserName(nameMap: Map<string, string>, userId: string): string {
  return nameMap.get(userId) ?? '不明なユーザー';
}

// resolveUserNameと同じ考え方のicon_url版（Issue #430）。呼び出し側が
// lib/auth.tsのfetchUserIconUrls()でまとめて取得したMapを渡す
export function resolveUserIconUrl(iconMap: Map<string, string | null>, userId: string): string | null {
  return iconMap.get(userId) ?? null;
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
