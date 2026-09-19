import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// anon keyはクライアントに埋め込んでよい公開キー。実際のアクセス制御は
// Supabase側のRLSポリシー（supabase/migrations/参照）が担うため、
// このキー自体に強い権限は無い（docs/decisions/0009-auth-email-magic-link.md,
// .note.md「Supabaseのanon key」参照）。
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が設定されていません（.env.development参照）'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // メールのマジックリンクはリダイレクトURLに`code`パラメータを付けて
    // 返す方式（PKCE）にする。React Nativeにはブラウザのようなアドレスバーが
    // 無いため、Web版がデフォルトで使うimplicitフロー（URLのfragmentに
    // access_tokenを直接載せる方式）は使わず、コードをexchangeCodeForSessionで
    // 交換する（docs/decisions/0009-auth-email-magic-link.md参照）。
    flowType: 'pkce',
  },
});
