// 「会いたい人」ハートアイコン（FriendsListScreen・FriendDetailScreen）の
// 見た目・タップ領域を揃えるための共通定義（Issue #320）。
// 2026-10-03のdeveloper指示により円形の背景（backgroundColor・borderWidth・
// borderRadius）は廃止し、ハートアイコン単体の表示にした。
//
// Issue #392：上記対応後、実機確認で視覚サイズ20x20・アイコン12pxが
// 押しにくいとの指摘。hitSlopで実質タップ領域は40x40あったが、ユーザーは
// 見えている大きさを基準に狙うため、視覚サイズ自体を拡大する（badge
// 28x28・icon 16px）。hitSlopは変更せず維持（badgeが大きくなった分、
// 実質タップ領域は48x48に拡大し、小さくなることはない）
//
// Issue #433：実機確認でまだ押しにくいとの指摘のため、もう2回り拡大する
// （badge 36x36・icon 20px）。hitSlopは現状維持（実質タップ領域は
// 56x56に拡大し、小さくなることはない）
export const WANT_TO_MEET_BADGE_SIZE = 36;
export const WANT_TO_MEET_BADGE_ICON_SIZE = 20;
export const WANT_TO_MEET_BADGE_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
