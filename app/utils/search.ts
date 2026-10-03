// 一覧画面の名前検索（部分一致）で共通して使う判定（Issue #251）。
// クエリが空（前後の空白のみ含む）の場合は常に一致扱いにし、全件表示に戻す。
// Issue #335：大小文字区別なしに加え、ひらがな／カタカナ・全角／半角の
// 表記揺れも吸収する（utils/kana.ts参照。漢字の読み仮名変換は対象外）
import { normalizeForSearch } from './kana';

export function matchesSearchQuery(name: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  return normalizeForSearch(name).includes(normalizeForSearch(trimmed));
}
