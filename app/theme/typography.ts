// フォントファミリーは Noto Sans JP に統一する（docs/design-system.md 参照）。
// 実際にNoto Sans JPを読み込む設定は別途 expo-font 導入時に fontFamily を追加する。

export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
