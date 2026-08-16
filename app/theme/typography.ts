// フォントは Noto Sans JP に統一する（docs/design-system.md 参照）。
// App.tsx の useFonts({ NotoSansJP_400Regular, NotoSansJP_700Bold }) で読み込み済み。

export const typography = {
  title: { fontSize: 22, fontFamily: 'NotoSansJP_700Bold' },
  heading: { fontSize: 18, fontFamily: 'NotoSansJP_700Bold' },
  body: { fontSize: 16, fontFamily: 'NotoSansJP_400Regular' },
  caption: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular' },
};
