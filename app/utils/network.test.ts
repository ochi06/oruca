import { isNetworkError } from './network';

describe('isNetworkError', () => {
  it('auth-jsのAuthRetryableFetchErrorはtrue', () => {
    expect(isNetworkError({ name: 'AuthRetryableFetchError', message: 'Service unavailable' })).toBe(true);
  });

  it('functions-jsのFunctionsFetchErrorはtrue', () => {
    expect(isNetworkError({ name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' })).toBe(true);
  });

  it('postgrest-jsが変換するfetch失敗（React Native）はtrue', () => {
    expect(isNetworkError({ message: 'TypeError: Network request failed' })).toBe(true);
  });

  it('postgrest-jsが変換するfetch失敗（Web）はtrue', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
  });

  it('タイムアウト（AbortError）はtrue', () => {
    expect(isNetworkError({ name: 'AbortError', message: 'Aborted' })).toBe(true);
  });

  it('PostgrestErrorなど通常のAPIエラーはfalse', () => {
    expect(isNetworkError({ message: 'duplicate key value violates unique constraint', code: '23505' })).toBe(false);
  });

  it('nullはfalse', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('文字列はfalse', () => {
    expect(isNetworkError('error')).toBe(false);
  });
});
