import { Ionicons } from '@expo/vector-icons';

// US-014: ステータス表示機能（docs/schema.md「USERS」参照）。
// USERS.statusに保存する値の一覧。プロフィール画面（切替UI）・
// 在席一覧（表示バッジ）の両方から参照する共通定義
export type UserStatus = 'working' | 'want_to_join' | 'away' | 'focus';

export const USER_STATUS_OPTIONS: {
  value: UserStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'working', label: '作業中', icon: 'briefcase-outline' },
  { value: 'want_to_join', label: '合流したい', icon: 'hand-left-outline' },
  { value: 'away', label: '離席中', icon: 'moon-outline' },
  { value: 'focus', label: '集中', icon: 'headset-outline' },
];

export function userStatusLabel(status: UserStatus | null): string | null {
  return USER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? null;
}

// マップのマーカーなど、名前を出さずアイコンだけでステータスを示したい箇所向け（Issue #120フォローアップ）
export function userStatusIcon(status: UserStatus | null): keyof typeof Ionicons.glyphMap | null {
  return USER_STATUS_OPTIONS.find((option) => option.value === status)?.icon ?? null;
}
