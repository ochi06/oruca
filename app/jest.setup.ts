process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// CI（Node 20）にはグローバルWebSocketが無く、supabase-jsのRealtimeClient初期化が
// 失敗するため、既にnode_modulesにある依存パッケージ経由でwsを渡す
// （@supabase/realtime-js公式の推奨対応）
if (typeof globalThis.WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  globalThis.WebSocket = require('ws');
}
