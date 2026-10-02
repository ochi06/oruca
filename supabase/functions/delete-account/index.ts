// Issue #228: アプリ内アカウント削除導線（Apple 5.1.1(v)・Google Play
// アカウント削除ポリシー対応）。クライアントから直接`auth.users`を削除する
// ことはできない（service role権限が必要）ため、Edge Function経由にする。
//
// 本人確認：呼び出し元のAuthorizationヘッダー（アクセストークン）をanon key
// クライアントにそのまま渡して`auth.getUser()`で検証し、トークンの持ち主
// 自身のIDのみを削除対象にする（他人のアカウントを削除できないようにする
// ため、本人確認はservice roleではなくanon+JWTで行う）。
//
// 削除処理：
// 1. avatarsバケット（{user_id}/...）のアイコン画像を削除する。Storageの
//    オブジェクトはpublic.usersの行とは別システムのため、PostgreSQLの
//    外部キーcascadeではクリーンアップされない
// 2. `auth.admin.deleteUser()`でauth.usersの行を削除する。docs/schema.md
//    「設計上の重要な原則」3.（退会時は機微データを含めすべて物理削除）の
//    通り、public.usersおよびそれを参照する全テーブル（areas・user_areas・
//    friendships・friend_area_links・otp_codes・presence_logs・groups・
//    group_members・notifications・area_schedules・
//    area_schedule_overrides）は、外部キーのon delete cascade
//    （一部on delete set null）で連動して物理削除される

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'missing authorization' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !callerData.user) {
    return new Response(JSON.stringify({ error: 'invalid session' }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const userId = callerData.user.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: avatarFiles, error: listError } = await adminClient.storage.from('avatars').list(userId);
  if (listError) throw listError;
  if (avatarFiles && avatarFiles.length > 0) {
    const { error: removeError } = await adminClient.storage
      .from('avatars')
      .remove(avatarFiles.map((file) => `${userId}/${file.name}`));
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
});
