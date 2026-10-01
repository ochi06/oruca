// Sentry（Issue #27）に送る前のデータから、位置情報など機微データを除く
// ための純粋関数群。oruca は位置情報を扱うプライバシー重視のアプリのため
// （docs/oruca_PRD.md）、緯度経度が外部サービスに送信されないことを
// テストで保証する

// キー名は小文字化して比較するため、lat/lng/latitude/longitudeの
// 大文字小文字・組み合わせ違い（center_lat等）を広めに拾う
const SENSITIVE_KEY_PATTERN = /lat|lng|latitude|longitude/i;

export function scrubSensitiveKeys<T>(value: T, depth = 0): T {
  if (depth > 5 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveKeys(item, depth + 1)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[Redacted]' : scrubSensitiveKeys(val, depth + 1);
  }
  return result as T;
}

// 自分のPRESENCE_LOGS/AREAS更新など、位置情報を含むSupabaseへのリクエストURL
// （クエリパラメータに緯度経度の値が載ることがある）をbreadcrumbから記録しない
export function isLocationRelatedRequest(url: string | undefined): boolean {
  if (!url) return false;
  return /\/(areas|presence_logs|user_areas)(\?|$)/.test(url);
}
