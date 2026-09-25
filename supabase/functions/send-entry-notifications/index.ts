// Issue #131: presence_logsへの新規入室INSERTをSupabase Database Webhookで
// フックして起動するEdge Function。「通知すべきか」の判定はここ（service role、
// クライアントを信用しない）で行い、対象者にExpo Push経由で配信する。
//
// Database Webhookのpayload形式（type/table/record/old_record）に依存する。
// presence_logsのINSERTイベントのみを購読する設定にすること（UPDATE＝位置更新や
// 退室では発火させない）。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  FriendshipRow,
  shouldSendEntryNotification,
  shouldSendWantToMeetNotification,
} from '../_shared/notifications.ts';
import { ExpoPushMessage, sendExpoPushMessages } from '../_shared/expoPush.ts';

type PresenceLogRow = {
  user_id: string;
  area_id: string;
  exited_at: string | null;
};

type WebhookPayload = {
  type: string;
  table: string;
  record: PresenceLogRow;
};

// Expo Push APIは1リクエスト最大100件（このプロジェクトの規模ではまず超えないが、念のため分割する）
const EXPO_PUSH_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();

  if (payload.table !== 'presence_logs' || payload.type !== 'INSERT') {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const { user_id: enteringUserId, area_id: areaId } = payload.record;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const [{ data: enteringUser, error: enteringUserError }, { data: area, error: areaError }] =
    await Promise.all([
      supabase
        .from('users')
        .select('name, allow_entry_notifications')
        .eq('id', enteringUserId)
        .single(),
      supabase.from('areas').select('name').eq('id', areaId).single(),
    ]);
  if (enteringUserError) throw enteringUserError;
  if (areaError) throw areaError;

  // friend_id = enteringUserId の行＝「入室した本人を友達として持っている人（受信者候補）」の設定
  const { data: friendships, error: friendshipsError } = await supabase
    .from('friendships')
    .select('user_id, notify_enabled, muted, notify_only_when_copresent, want_to_meet')
    .eq('friend_id', enteringUserId)
    .eq('status', 'active');
  if (friendshipsError) throw friendshipsError;

  const candidateRecipientIds = (friendships ?? []).map((f) => f.user_id);
  if (candidateRecipientIds.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  // 受信者候補のうち、入室先エリアに現在在席している人（notify_only_when_copresent判定用）
  const { data: copresentLogs, error: copresentError } = await supabase
    .from('presence_logs')
    .select('user_id')
    .eq('area_id', areaId)
    .is('exited_at', null)
    .in('user_id', candidateRecipientIds);
  if (copresentError) throw copresentError;
  const copresentUserIds = new Set((copresentLogs ?? []).map((log) => log.user_id));

  type EligibleRecipient = { userId: string; reason: 'entry' | 'want_to_meet' };
  const eligibleRecipients: EligibleRecipient[] = [];

  for (const friendship of friendships ?? []) {
    const friendshipRow: FriendshipRow = {
      notify_enabled: friendship.notify_enabled,
      muted: friendship.muted,
      notify_only_when_copresent: friendship.notify_only_when_copresent,
      want_to_meet: friendship.want_to_meet,
    };
    const isRecipientPresent = copresentUserIds.has(friendship.user_id);

    if (shouldSendEntryNotification(friendshipRow, isRecipientPresent)) {
      eligibleRecipients.push({ userId: friendship.user_id, reason: 'entry' });
    } else if (shouldSendWantToMeetNotification(friendshipRow, enteringUser.allow_entry_notifications)) {
      eligibleRecipients.push({ userId: friendship.user_id, reason: 'want_to_meet' });
    }
  }

  if (eligibleRecipients.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  const { data: recipientUsers, error: recipientUsersError } = await supabase
    .from('users')
    .select('id, push_token')
    .in(
      'id',
      eligibleRecipients.map((r) => r.userId)
    );
  if (recipientUsersError) throw recipientUsersError;

  const pushTokenByUserId = new Map(
    (recipientUsers ?? [])
      .filter((u): u is { id: string; push_token: string } => !!u.push_token)
      .map((u) => [u.id, u.push_token])
  );

  const messages: ExpoPushMessage[] = eligibleRecipients
    .filter((recipient) => pushTokenByUserId.has(recipient.userId))
    .map((recipient) => ({
      to: pushTokenByUserId.get(recipient.userId)!,
      title: recipient.reason === 'want_to_meet' ? '会いたい人が入室しました' : '友達が入室しました',
      body: `${enteringUser.name}さんが${area.name}に入室しました`,
      data: { areaId, enteringUserId },
    }));

  for (const batch of chunk(messages, EXPO_PUSH_CHUNK_SIZE)) {
    await sendExpoPushMessages(batch);
  }

  return new Response(JSON.stringify({ notified: messages.length }), { status: 200 });
});
