// Issue #131: presence_logsへの新規入室INSERTをSupabase Database Webhookで
// フックして起動するEdge Function。「通知すべきか」の判定はここ（service role、
// クライアントを信用しない）で行い、対象者にExpo Push経由で配信する。
// あわせてNOTIFICATIONS（通知ボックス、Issue #160）にentry/want_to_meet行を作成する。
//
// Database Webhookのpayload形式（type/table/record/old_record）に依存する。
// presence_logsのINSERTイベントのみを購読する設定にすること（UPDATE＝位置更新や
// 退室では発火させない）。
//
// Issue #163：入室した本人向けのarrival_summary（「今会える人」一覧）も
// あわせて生成する。「会える」判定はFRIEND_AREA_LINKS基準（そのエリアでの
// 合意がstatus='approved'）に統一する（開発者確認済み、2026-10-01。名前表示
// 条件と一致させ、「会えると通知が来たのに名前が見えない」という矛盾を無くす
// ため。FRIENDSHIPSの有無やグループ同席は見ない）。entry/want_to_meetとは
// 通知の向き（受信者が逆＝入室した本人が受信者）が違うため、別ブロックとして
// 独立に扱う。プッシュ通知は送らず、通知ボックス（NOTIFICATIONS）行の作成のみ
// 行う（US-021の要件が「通知ボックスに表示」のため）。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FriendshipRow, shouldSendEntryNotification } from '../_shared/notifications.ts';
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
        .select('name, allow_entry_notifications, is_anonymous')
        .eq('id', enteringUserId)
        .single(),
      supabase.from('areas').select('name').eq('id', areaId).single(),
    ]);
  if (enteringUserError) throw enteringUserError;
  if (areaError) throw areaError;

  // Issue #163：入室した本人向けのarrival_summary。このareaでFRIEND_AREA_LINKS
  // がstatus='approved'な相手のうち、現在このareaに在席中（exited_at is null）の
  // 人を「今会える人」として1人1行で作成する
  const { data: approvedAreaLinks, error: areaLinksError } = await supabase
    .from('friend_area_links')
    .select('initiator_id, friend_id')
    .eq('area_id', areaId)
    .eq('status', 'approved')
    .or(`initiator_id.eq.${enteringUserId},friend_id.eq.${enteringUserId}`);
  if (areaLinksError) throw areaLinksError;

  const meetableCandidateIds = Array.from(
    new Set(
      (approvedAreaLinks ?? []).map((link) =>
        link.initiator_id === enteringUserId ? link.friend_id : link.initiator_id
      )
    )
  );

  if (meetableCandidateIds.length > 0) {
    const { data: meetablePresenceLogs, error: meetablePresenceError } = await supabase
      .from('presence_logs')
      .select('user_id')
      .eq('area_id', areaId)
      .is('exited_at', null)
      .in('user_id', meetableCandidateIds);
    if (meetablePresenceError) throw meetablePresenceError;

    const meetableUserIds = Array.from(
      new Set((meetablePresenceLogs ?? []).map((log) => log.user_id))
    );

    if (meetableUserIds.length > 0) {
      const { error: arrivalSummaryError } = await supabase.from('notifications').insert(
        meetableUserIds.map((meetableUserId) => ({
          user_id: enteringUserId,
          type: 'arrival_summary',
          related_user_id: meetableUserId,
          area_id: areaId,
        }))
      );
      if (arrivalSummaryError) throw arrivalSummaryError;
    }
  }

  // friend_id = enteringUserId の行＝「入室した本人を友達として持っている人（受信者候補）」の設定
  const { data: friendships, error: friendshipsError } = await supabase
    .from('friendships')
    .select('user_id, notify_enabled, muted, want_to_meet')
    .eq('friend_id', enteringUserId)
    .eq('status', 'active');
  if (friendshipsError) throw friendshipsError;

  const candidateRecipientIds = (friendships ?? []).map((f) => f.user_id);
  if (candidateRecipientIds.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  // 受信者候補のうち、入室先エリアに現在在席している人（Issue #270：
  // 共在時のみ通知の個別トグルを廃止し、常時適用のルールになったための判定）
  const { data: copresentLogs, error: copresentError } = await supabase
    .from('presence_logs')
    .select('user_id')
    .eq('area_id', areaId)
    .is('exited_at', null)
    .in('user_id', candidateRecipientIds);
  if (copresentError) throw copresentError;
  const copresentUserIds = new Set((copresentLogs ?? []).map((log) => log.user_id));

  // reasonはpush文言・NOTIFICATIONS.typeの出し分け用。共在していればentry、
  // 共在していない場合にshouldSendEntryNotificationがtrueを返すのは
  // want_to_meet由来の通知のみなのでwant_to_meetと判定できる
  type EligibleRecipient = { userId: string; reason: 'entry' | 'want_to_meet' };
  const eligibleRecipients: EligibleRecipient[] = [];

  for (const friendship of friendships ?? []) {
    const friendshipRow: FriendshipRow = {
      notify_enabled: friendship.notify_enabled,
      muted: friendship.muted,
      want_to_meet: friendship.want_to_meet,
    };
    const isRecipientPresent = copresentUserIds.has(friendship.user_id);

    if (
      shouldSendEntryNotification(
        friendshipRow,
        isRecipientPresent,
        enteringUser.allow_entry_notifications,
        enteringUser.is_anonymous
      )
    ) {
      eligibleRecipients.push({
        userId: friendship.user_id,
        reason: isRecipientPresent ? 'entry' : 'want_to_meet',
      });
    }
  }

  if (eligibleRecipients.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 });
  }

  // 通知ボックス（NOTIFICATIONS、Issue #160）用の行を作成する。Expo Pushの
  // 送信可否（push_token有無）とは独立に、対象者全員分を作成する
  const { error: notificationsError } = await supabase.from('notifications').insert(
    eligibleRecipients.map((recipient) => ({
      user_id: recipient.userId,
      type: recipient.reason,
      related_user_id: enteringUserId,
      area_id: areaId,
    }))
  );
  if (notificationsError) throw notificationsError;

  const { data: recipientUsers, error: recipientUsersError } = await supabase
    .from('users')
    .select('id, push_token, entry_vibration_enabled')
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
  // Issue #169：受信者ごとの振動設定。行が見つからない場合はデフォルト
  // （true、USERS.entry_vibration_enabledの既定値と同じ）扱いにする
  const vibrationEnabledByUserId = new Map(
    (recipientUsers ?? []).map((u) => [u.id, u.entry_vibration_enabled ?? true])
  );

  const messages: ExpoPushMessage[] = eligibleRecipients
    .filter((recipient) => pushTokenByUserId.has(recipient.userId))
    .map((recipient) => {
      const vibrationEnabled = vibrationEnabledByUserId.get(recipient.userId) ?? true;
      return {
        to: pushTokenByUserId.get(recipient.userId)!,
        title: recipient.reason === 'want_to_meet' ? '会いたい人が入室しました' : '友達が入室しました',
        body: `${enteringUser.name}さんが${area.name}に入室しました`,
        data: { areaId, enteringUserId },
        // iOS：soundを省略するとサイレント通知（音・振動ともに鳴らない）になる
        sound: vibrationEnabled ? 'default' : undefined,
        // Android：事前にクライアント側で作成した通知チャンネル
        // （app/hooks/usePushNotificationRegistration.ts参照）を指定する
        channelId: vibrationEnabled ? 'entry-vibrate' : 'entry-silent',
      };
    });

  for (const batch of chunk(messages, EXPO_PUSH_CHUNK_SIZE)) {
    await sendExpoPushMessages(batch);
  }

  return new Response(JSON.stringify({ notified: messages.length }), { status: 200 });
});
