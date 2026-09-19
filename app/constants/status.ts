// US-014: ステータス表示機能（docs/schema.md「USERS」参照）。
// USERS.statusに保存する値の一覧。プロフィール画面（切替UI）・
// 在席一覧（表示バッジ）の両方から参照する共通定義
export type UserStatus = 'working' | 'want_to_join' | 'away' | 'focus';

export const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: 'working', label: '作業中' },
  { value: 'want_to_join', label: '合流したい' },
  { value: 'away', label: '離席中' },
  { value: 'focus', label: '集中' },
];

export function userStatusLabel(status: UserStatus | null): string | null {
  return USER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? null;
}
