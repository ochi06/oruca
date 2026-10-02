// Issue #163: group_membersへの新規INSERTをSupabase Database Webhookで
// フックして起動するEdge Function。招待された本人（record.user_id）に
// group_invite通知を作成し、Expo Push経由でも知らせる。
//
// 「実際の招待」とみなすのはinvited_by is not nullの行のみ（既存メンバー/
// オーナーが友達を招待した場合、lib/groups.ts inviteMember参照）。
// 以下は対象外（通知不要）：
// - 自己申請のpending行（公開グループ参加申請。invited_by is null）
// - オープングループへの自己参加のapproved行（QR/招待コード、invited_by is null）
// - グループ作成時、オーナー自身の初期approved行（invited_by is null）
//
// Database Webhookのpayload形式（type/table/record/old_record）に依存する。
// group_membersのINSERTイベントのみを購読する設定にすること。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ExpoPushMessage, sendExpoPushMessages } from '../_shared/expoPush.ts';

type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string;
  invited_by: string | null;
  status: string;
};

type WebhookPayload = {
  type: string;
  table: string;
  record: GroupMemberRow;
};

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();

  if (payload.table !== 'group_members' || payload.type !== 'INSERT') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const { id: groupMemberId, group_id: groupId, user_id: invitedUserId, invited_by: invitedBy } = payload.record;

  // 自己申請・自己参加（招待コード経由含む）は通知不要
  if (!invitedBy) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const [{ data: group, error: groupError }, { data: invitedUser, error: invitedUserError }] =
    await Promise.all([
      supabase.from('groups').select('name').eq('id', groupId).single(),
      supabase.from('users').select('push_token').eq('id', invitedUserId).single(),
    ]);
  if (groupError) throw groupError;
  if (invitedUserError) throw invitedUserError;

  const { error: notificationError } = await supabase.from('notifications').insert({
    user_id: invitedUserId,
    type: 'group_invite',
    related_user_id: invitedBy,
    group_member_id: groupMemberId,
  });
  if (notificationError) throw notificationError;

  if (invitedUser.push_token) {
    const message: ExpoPushMessage = {
      to: invitedUser.push_token,
      title: 'グループに招待されました',
      body: `「${group.name}」に招待されました`,
      data: { groupId },
      sound: 'default',
    };
    await sendExpoPushMessages([message]);
  }

  return new Response(JSON.stringify({ notified: invitedUser.push_token ? 1 : 0 }), { status: 200 });
});
