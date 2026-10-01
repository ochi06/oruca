import { supabase } from './supabase';
import { uploadIconToAvatarsBucket } from './avatars';
import { UserStatus } from '../constants/status';

// 初回ログイン時にUSERSテーブルへ入れる仮の初期表示名
export const DEFAULT_USER_NAME = 'ゲスト';

// 現在ログイン中のユーザーIDを返す。ADR-0010でメールログインに移行した後は、
// ここで新規セッションを作ることはしない（未ログイン状態は呼び出し側のバグか、
// App.tsxのログインゲートを通らずに呼ばれた異常系なので例外にする）。
// 関数名・シグネチャは移行前（匿名ログイン時代）から変えていない
// （呼び出し側の各画面を変更しないため）
export async function ensureSignedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error('ログインしていません');
  }
  return data.session.user.id;
}

// メールアドレス宛に6桁のログインコードを送信する（ADR-0010）。
// マジックリンク方式（ADR-0009）は、Gmail等のメールセキュリティ機能が
// ユーザーのクリック前にリンクを自動で開いてしまい、使い捨てトークンを
// 消費してしまう問題が実機検証で見つかったため、手入力のコード方式に変更した
export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) {
    throw error;
  }
}

// メールに届いた6桁のコードでログインを完了させる（ADR-0010）
export async function verifyLoginCode(email: string, code: string): Promise<string> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error || !data.session) {
    throw error ?? new Error('ログインに失敗しました');
  }
  return data.session.user.id;
}

// メール登録なしでオープングループのQR参加のみを行うための匿名セッションを
// 作る（Issue #151、ADR-0007で一度廃止した匿名ログインをこの用途に限定復活）。
// 通常のメールOTPログイン（sendLoginCode/verifyLoginCode）とは独立した経路で、
// 作られたセッションはfriendships作成・closedグループの作成/参加からRLSで
// 締め出される（supabase/migrations/20261001170000_anonymous_open_group_join.sql）
export async function signInAnonymously(): Promise<string> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) {
    throw error ?? new Error('ログインに失敗しました');
  }
  return data.session.user.id;
}

// 現在のセッションが匿名ログイン（signInAnonymously）由来かどうかを返す。
// USERS.is_anonymous（US-013、在席非公開設定）とは別物なので注意
export async function isCurrentSessionAnonymous(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.is_anonymous ?? false;
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

// 自分のusers.nameを更新する（Issue #111：Issue #106でAreaJoinScreen経由の
// 名前設定導線が消え、他に呼び出し元が無くなった際に一度削除されていたが、
// ProfileScreenでの名前編集用に復活させた）
export async function updateUserName(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('users').update({ name }).eq('id', userId);
  if (error) {
    throw error;
  }
}

// 自分の現在のusers.statusを取得する（US-014、Issue #10）
export async function fetchUserStatus(userId: string): Promise<UserStatus | null> {
  const { data, error } = await supabase.from('users').select('status').eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return (data?.status as UserStatus | null) ?? null;
}

// 自分のusers.statusを更新する（US-014、Issue #10）。nullを渡すと未設定に戻す
export async function updateUserStatus(userId: string, status: UserStatus | null): Promise<void> {
  const { error } = await supabase.from('users').update({ status }).eq('id', userId);
  if (error) {
    throw error;
  }
}

// 自分のusers.push_tokenを更新する（Issue #131）。複数端末対応はせず、
// 最後にログインした端末のExpoPushTokenで上書きする単純な設計
export async function updateUserPushToken(userId: string, pushToken: string): Promise<void> {
  const { error } = await supabase.from('users').update({ push_token: pushToken }).eq('id', userId);
  if (error) {
    throw error;
  }
}

// 自分の現在のusers.entry_vibration_enabledを取得する（Issue #169）
export async function fetchUserEntryVibrationEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('entry_vibration_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data?.entry_vibration_enabled ?? true;
}

// 自分のusers.entry_vibration_enabledを更新する（Issue #169）。入室通知を
// 受け取った時に振動させるかどうかの設定。send-entry-notifications
// Edge Functionが受信者ごとにこの値を見て、Expo Pushメッセージの
// sound/channelIdを切り替える
export async function updateUserEntryVibrationEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ entry_vibration_enabled: enabled })
    .eq('id', userId);
  if (error) {
    throw error;
  }
}

// 自分の現在のusers.icon_urlを取得する
export async function fetchUserIconUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('icon_url').eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data?.icon_url ?? null;
}

// プロフィールアイコンをavatarsバケット（`{user_id}/icon.<拡張子>`、公開読み取り・
// 本人のみ書き込み可。docs/schema.md「USERS」・supabase/migrations参照）に
// アップロードし、公開URLをusers.icon_urlに反映する（Issue #34）。
// 同じパスに上書き保存するため、再アップロードのたびに前のファイルは置き換わる
export async function updateUserIcon(userId: string, localUri: string): Promise<string> {
  const iconUrl = await uploadIconToAvatarsBucket(`${userId}/icon.jpg`, localUri);

  const { error: updateError } = await supabase.from('users').update({ icon_url: iconUrl }).eq('id', userId);
  if (updateError) {
    throw updateError;
  }

  return iconUrl;
}
