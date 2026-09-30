import { mockUsers } from '../mocks/presence';

// 複数の画面（グループ詳細・招待一覧・通知ボックス等）で同じ形の
// user_id→表示名解決が必要なため共通化した
export function findUserName(userId: string): string {
  return mockUsers.find((user) => user.id === userId)?.name ?? '不明なユーザー';
}
