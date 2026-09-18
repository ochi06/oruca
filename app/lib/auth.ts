import { supabase } from './supabase';

// ADR-0007: 匿名ログイン。既にセッションがあれば再利用し、無ければ新規作成する。
// USERS.idはこのauth.uid()と同じ値になる想定（RLSポリシー参照）。
export async function ensureSignedIn(): Promise<string> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) {
    return existing.session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw error ?? new Error('匿名ログインに失敗しました');
  }
  return data.session.user.id;
}

// USERSテーブルにも自分の行を用意する（初回ログイン時のみ必要）。
// nameは後でプロフィール画面から変更できる前提の仮の値。
export async function ensureUserRow(userId: string, defaultName: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .upsert({ id: userId, name: defaultName }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    throw error;
  }
}
