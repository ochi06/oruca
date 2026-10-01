// Issue #148: グループのclosed/open種別に関する純粋関数群。
// DB側のCHECK制約（type='open'はarea_id必須、'closed'はarea_id無し）と
// 対応する入力検証、オープングループの有効期限・可視性ルールをまとめる。

import { Group } from '../mocks/groups';

export const OPEN_GROUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7日

// オープングループ作成時のexpires_at（created_at + 7日）を計算する
export function computeOpenGroupExpiresAt(createdAt: Date): string {
  return new Date(createdAt.getTime() + OPEN_GROUP_TTL_MS).toISOString();
}

// グループ作成フォームの入力検証（DB側のgroups_area_id_matches_type制約と対応）。
// typeによらずarea_idが必須（Issue #204、2026-10-02開発者確認：oruca自体が
// エリア限定・関係限定の在席可視化アプリであるため、closedグループも
// 何らかのエリアに紐付け必須にする。寿命(expires_at)はopen限定のまま変更なし）
export function validateGroupTypeAndArea(areaId: string | null): 'area_required' | null {
  if (!areaId) {
    return 'area_required';
  }
  return null;
}

// 期限切れのオープングループかどうか（closedは常にfalse、expires_at未設定もfalse）
export function isExpiredOpenGroup(group: Pick<Group, 'type' | 'expires_at'>, now: Date): boolean {
  if (group.type !== 'open' || !group.expires_at) {
    return false;
  }
  return new Date(group.expires_at).getTime() <= now.getTime();
}

// オープングループのメンバー在席状況を見てよいか（RLSではなくクエリ側フィルタ、
// docs/schema.md GROUP_MEMBERS参照）。closedグループは常に見える（従来通り）。
// openグループは、自分がそのarea_idに現在在籍中の場合のみ見える
export function canSeeOpenGroupPresence(
  group: Pick<Group, 'type'>,
  selfIsPresentInGroupArea: boolean
): boolean {
  if (group.type !== 'open') {
    return true;
  }
  return selfIsPresentInGroupArea;
}
