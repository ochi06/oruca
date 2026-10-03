// 検索時の表記揺れ（ひらがな／カタカナ・全角／半角・大文字小文字）を
// 吸収するための正規化ユーティリティ（Issue #335）。
//
// 注意：漢字の読み仮名変換（例：「部室」という表記に対して「ぶしつ」で
// 検索してヒットさせる）は、読み仮名の辞書データが無いと機械的に導出
// できない。`docs/ai-collaboration-plan.md`の方針（AREASに読み仮名列を
// 追加しない）に従う限り、この関数はその変換までは行わない。
// ひらがな⇔カタカナ・全角⇔半角の表記揺れのみを吸収する

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x60; // カタカナ→ひらがなのコードポイント差

// カタカナをひらがなに変換する（例：「ブシツ」→「ぶしつ」）
export function katakanaToHiragana(input: string): string {
  let result = '';
  for (const char of input) {
    const code = char.charCodeAt(0);
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      result += String.fromCharCode(code - HIRAGANA_OFFSET);
    } else {
      result += char;
    }
  }
  return result;
}

// 全角英数字・全角スペースを半角に変換する
export function toHalfWidth(input: string): string {
  return input
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

// 検索比較用の正規化：半角化→カタカナをひらがなに統一→小文字化
export function normalizeForSearch(input: string): string {
  return katakanaToHiragana(toHalfWidth(input)).toLowerCase();
}
