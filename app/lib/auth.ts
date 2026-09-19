import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

// アイコン表示は現状96px程度のため、これより大きい解像度でアップロードしても
// 表示上の意味がなく、転送時間が伸びるだけになる（Issue #91）
const ICON_MAX_DIMENSION_PX = 256;

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
  const path = `${userId}/icon.jpg`;

  // 端末カメラの写真は数千px四方になり得るため、アップロード前にアイコン表示に
  // 十分なサイズへ縮小する。出力形式もJPEGに統一する（Issue #91）
  const context = ImageManipulator.manipulate(localUri).resize({ width: ICON_MAX_DIMENSION_PX });
  const resizedImage = await context.renderAsync();
  const resized = await resizedImage.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

  // React NativeではBlob/File/FormDataを渡してもsupabase-js側が期待する
  // バイナリ形式と一致せず、実行時にアップロードが失敗する（型キャストで
  // コンパイルは通ってしまうため気づきにくい）。ArrayBufferを渡す必要がある
  // （supabase-jsのStorageFileApi.upload docコメント・Issue #88参照）
  const file = new File(resized.uri);
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // 上書き保存だと同じURLがキャッシュされ、更新後も古い画像が表示され続けることがあるため、
  // 末尾にキャッシュバスター用のクエリを付ける
  const iconUrl = `${data.publicUrl}?updated=${Date.now()}`;

  const { error: updateError } = await supabase.from('users').update({ icon_url: iconUrl }).eq('id', userId);
  if (updateError) {
    throw updateError;
  }

  return iconUrl;
}
