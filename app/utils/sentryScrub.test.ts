import { scrubSensitiveKeys, isLocationRelatedRequest } from './sentryScrub';

describe('scrubSensitiveKeys', () => {
  test('lat/lngキーの値を[Redacted]に置き換える', () => {
    expect(scrubSensitiveKeys({ lat: 35.0, lng: 135.0, name: '部室' })).toEqual({
      lat: '[Redacted]',
      lng: '[Redacted]',
      name: '部室',
    });
  });

  test('center_lat/center_lng・latitude/longitudeなど、大文字小文字・組み合わせ違いも拾う', () => {
    expect(
      scrubSensitiveKeys({ center_lat: 35.0, center_lng: 135.0, Latitude: 1, LONGITUDE: 2 })
    ).toEqual({
      center_lat: '[Redacted]',
      center_lng: '[Redacted]',
      Latitude: '[Redacted]',
      LONGITUDE: '[Redacted]',
    });
  });

  test('ネストしたオブジェクト・配列の中のlat/lngも再帰的に除く', () => {
    expect(
      scrubSensitiveKeys({
        body: { user_id: 'user-a', lat: 35.0, lng: 135.0 },
        items: [{ lat: 1 }, { lat: 2 }],
      })
    ).toEqual({
      body: { user_id: 'user-a', lat: '[Redacted]', lng: '[Redacted]' },
      items: [{ lat: '[Redacted]' }, { lat: '[Redacted]' }],
    });
  });

  test('機微データを含まないオブジェクトはそのまま返す', () => {
    const value = { user_id: 'user-a', note: '平日9-19時' };
    expect(scrubSensitiveKeys(value)).toEqual(value);
  });

  test('null・プリミティブ値はそのまま返す', () => {
    expect(scrubSensitiveKeys(null)).toBeNull();
    expect(scrubSensitiveKeys(undefined)).toBeUndefined();
    expect(scrubSensitiveKeys('text')).toBe('text');
    expect(scrubSensitiveKeys(42)).toBe(42);
  });
});

describe('isLocationRelatedRequest', () => {
  test('areas・presence_logs・user_areasへのリクエストはtrueを返す', () => {
    expect(isLocationRelatedRequest('https://xyz.supabase.co/rest/v1/areas?select=*')).toBe(true);
    expect(isLocationRelatedRequest('https://xyz.supabase.co/rest/v1/presence_logs')).toBe(true);
    expect(isLocationRelatedRequest('https://xyz.supabase.co/rest/v1/user_areas?id=eq.1')).toBe(true);
  });

  test('関係のないテーブルへのリクエストはfalseを返す', () => {
    expect(isLocationRelatedRequest('https://xyz.supabase.co/rest/v1/users?select=*')).toBe(false);
  });

  test('urlがundefinedの場合はfalseを返す', () => {
    expect(isLocationRelatedRequest(undefined)).toBe(false);
  });
});
