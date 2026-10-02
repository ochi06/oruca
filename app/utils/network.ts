// ネットワーク接続不可・タイムアウトに起因するエラーかどうかを判定する（Issue #314）。
// 会場Wi-Fi等の不安定な環境を想定し、ログイン・グループ参加のエラー表示を
// 「入力内容の誤り」と区別するために使う。
//
// Supabaseクライアントのエラー表現は呼び出し経路によって形が異なるため、
// 複数パターンをゆるく判定する：
// - auth-js（signInWithOtp等）はfetch失敗時に`name: 'AuthRetryableFetchError'`
// - functions-js（Edge Function呼び出し）は`name: 'FunctionsFetchError'`
// - postgrest-js（rpc/テーブル操作）はfetch失敗を素通りさせず、
//   `message: "${fetchError.name}: ${fetchError.message}"`
//   （例："TypeError: Network request failed"、タイムアウトは"AbortError: ..."）
//   という形のオブジェクトに変換してから投げる
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const name = 'name' in error && typeof error.name === 'string' ? error.name.toLowerCase() : '';
  if (name === 'authretryablefetcherror' || name === 'functionsfetcherror' || name === 'aborterror') {
    return true;
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('aborterror') ||
    message.includes('timeout')
  );
}
