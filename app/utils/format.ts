// 日時・人数表示のフォーマットを統一するユーティリティ

// 時刻は "14:23" のようなコロン区切り（"14時23分"のような表記は使わない）
export function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// 在席人数の表示。0人の場合は「在席中の人はいません」に切り替える
export function formatPresenceCount(count: number): string {
  if (count === 0) return '在席中の人はいません';
  return `${count}人在席中`;
}

// "YYYY-MM-DD"形式の今日の日付（US-011の当日上書き予定で使う）。
// toISOString()はUTC基準のため、日本時間の深夜0時台に日付がずれる
// ことがある。ローカルタイムゾーンの暦日をそのまま使う
export function todayDateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}
