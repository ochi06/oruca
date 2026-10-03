// Issue #420: friend_area_linksへの新規INSERT（status='pending'）をSupabase
// Database Webhookでフックして起動するEdge Function。提案を受け取る側
// （record.friend_id）にarea_link_proposed通知を作成し、Expo Push経由でも
// 知らせる。send-group-invite-notificationと同じパターン
// （クライアント側のRLS insertは単一方向のイベントのため、Webhook経由で
// 問題なく受信者を特定できる）。
//
// Database Webhookのpayload形式（type/table/record/old_record）に依存する。
// friend_area_linksのINSERTイベントのみを購読する設定にすること。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ExpoPushMessage, sendExpoPushMessages } from '../_shared/expoPush.ts';

type FriendAreaLinkRow = {
  id: string;
  initiator_id: string;
  friend_id: string;
  area_id: string;
  status: string;
};

type WebhookPayload = {
  type: string;
  table: string;
  record: FriendAreaLinkRow;
};

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();

  if (payload.table !== 'friend_area_links' || payload.type !== 'INSERT') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const { initiator_id: initiatorId, friend_id: friendId, area_id: areaId, status } = payload.record;

  // 新規提案（pending）のみ通知する
  if (status !== 'pending') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const [{ data: initiator, error: initiatorError }, { data: area, error: areaError }, { data: recipient, error: recipientError }] =
    await Promise.all([
      supabase.from('users').select('name').eq('id', initiatorId).single(),
      supabase.from('areas').select('name').eq('id', areaId).single(),
      supabase.from('users').select('push_token').eq('id', friendId).single(),
    ]);
  if (initiatorError) throw initiatorError;
  if (areaError) throw areaError;
  if (recipientError) throw recipientError;

  const { error: notificationError } = await supabase.from('notifications').insert({
    user_id: friendId,
    type: 'area_link_proposed',
    related_user_id: initiatorId,
    area_id: areaId,
  });
  if (notificationError) throw notificationError;

  if (recipient.push_token) {
    const message: ExpoPushMessage = {
      to: recipient.push_token,
      title: 'エリアの紐づけ提案',
      body: `${initiator.name}さんから「${area.name}」での紐づけを提案されました`,
      data: { areaId },
      sound: 'default',
    };
    await sendExpoPushMessages([message]);
  }

  return new Response(JSON.stringify({ notified: recipient.push_token ? 1 : 0 }), { status: 200 });
});
