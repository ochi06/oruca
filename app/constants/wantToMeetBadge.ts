// 「会いたい人」ハートバッジ（FriendsListScreen・FriendDetailScreen）の
// 見た目・タップ領域を揃えるための共通定義（Issue #320）。
// 視覚的なバッジサイズは小さいまま、hitSlopでタップ領域のみ40pt四方に広げる
// （アバターサイズに対してバッジ自体を40ptにすると不自然に大きくなるため）
export const WANT_TO_MEET_BADGE_SIZE = 20;
export const WANT_TO_MEET_BADGE_ICON_SIZE = 12;
export const WANT_TO_MEET_BADGE_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
