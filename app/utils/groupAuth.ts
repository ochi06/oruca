// docs/schema.md GROUPS: owner_user_id が唯一の管理者（複数管理者は未対応）。
// グループの承認・拒否・強制退会など「管理者だけが行ってよい操作」は、
// 必ずこの関数で認可（Authorization）チェックをしてから実行すること。
//
// 認証（Authentication）＝「あなたは誰か」はSupabase Auth側の責務で確認済み
// という前提。この関数が見るのは認可（Authorization）＝「その人はこのグループで
// 管理者操作をしてよいか」だけ、という違いを意識して実装する。

import { Group } from '../mocks/groups';

export function isGroupAdmin(group: Group, userId: string): boolean {
  return group.owner_user_id === userId;
}
