import { supabase } from './supabase';

// プロフィール編集画面ができるまでの仮の初期表示名。
// この名前のままなら「まだ名前を設定していない」とみなす（Issue #65後続）
export const DEFAULT_USER_NAME = 'ゲスト';

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

// 自分の現在のusers.nameを取得する
export async function fetchUserName(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('name').eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data?.name ?? null;
}

// 自分のusers.nameを更新する（プロフィール編集画面ができるまでの暫定経路。
// Issue #65：エリア参加直後、まだDEFAULT_USER_NAMEのままなら名前入力を促す）
export async function updateUserName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('users').update({ name }).eq('id', userId);
  if (error) {
    throw error;
  }
}
