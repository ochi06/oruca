// Issue #228: クライアント（Expo/Web）から直接呼び出すEdge Function用の
// CORSヘッダー。Webビルド（Issue #190）経由のブラウザからの呼び出しは
// ブラウザのCORSチェック対象になるため必要（既存のWebhook専用Edge
// Functionsはサーバー間通信のみで不要だった）。

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
