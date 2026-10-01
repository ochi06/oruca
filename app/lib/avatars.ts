// avatarsバケット（`{user_id}/...`、公開読み取り・本人のみ書き込み可。
// supabase/migrations/20260919020000_avatars_storage.sql参照）へのアイコン
// アップロード処理。プロフィールアイコン（Issue #34）・グループ内限定の
// 表示アイコン（Issue #150）の両方から使う共通処理のため切り出した。

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

// アイコン表示は現状96px程度のため、これより大きい解像度でアップロードしても
// 表示上の意味がなく、転送時間が伸びるだけになる（Issue #91）
const ICON_MAX_DIMENSION_PX = 256;

// pathは`{user_id}/...`で始まる必要がある（storage.foldername(name)の
// 第1要素がauth.uid()と一致する場合のみ書き込みを許可するRLSのため）。
// 公開URLを返す（キャッシュバスター付き、上書き保存時も最新画像が表示されるように）
export async function uploadIconToAvatarsBucket(path: string, localUri: string): Promise<string> {
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
  return `${data.publicUrl}?updated=${Date.now()}`;
}
