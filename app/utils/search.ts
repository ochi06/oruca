// 一覧画面の名前検索（部分一致・大小文字区別なし）で共通して使う判定（Issue #251）。
// クエリが空（前後の空白のみ含む）の場合は常に一致扱いにし、全件表示に戻す
export function matchesSearchQuery(name: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  return name.toLowerCase().includes(trimmed.toLowerCase());
}
