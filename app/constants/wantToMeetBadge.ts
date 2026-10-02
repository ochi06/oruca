// 「会いたい人」ハートアイコン（FriendsListScreen・FriendDetailScreen）の
// 見た目・タップ領域を揃えるための共通定義（Issue #320）。
// 2026-10-03のdeveloper指示により円形の背景（backgroundColor・borderWidth・
// borderRadius）は廃止し、ハートアイコン単体の表示にした。視覚サイズは
// アイコンサイズのみで決まる小さいままにし、hitSlopでタップ領域のみ
// 40pt四方に広げる（アバターサイズに対してタップ領域自体を40ptにすると
// 不自然に大きくなるため）
export const WANT_TO_MEET_BADGE_SIZE = 20;
export const WANT_TO_MEET_BADGE_ICON_SIZE = 12;
export const WANT_TO_MEET_BADGE_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
