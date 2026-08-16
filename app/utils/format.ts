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
