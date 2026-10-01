// Expo Push Service（https://exp.host/--/api/v2/push/send）への送信ヘルパー。
// 1リクエストあたり最大100件までまとめて送れる仕様のため、呼び出し側で
// チャンク分割してから渡す想定（このプロジェクトの規模ではまず超えない）。

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  // Issue #169：受信者のentry_vibration_enabledに応じて振動の有無を
  // 切り替えるためのフィールド。
  // iOS：soundを省略する（未指定）とサイレント通知になり、音と振動の両方が
  // 鳴らない。APNs経由のリモート通知では音と振動を個別制御できないため、
  // 振動だけを消すことはできない（Notification Service Extensionが
  // 必要になるが、Expo管理アプリの範囲外のためスコープ外とする）
  sound?: 'default';
  // Android：振動あり/なしの通知チャンネル（クライアント側で事前に
  // Notifications.setNotificationChannelAsyncで作成、
  // app/hooks/usePushNotificationRegistration.ts参照）をchannelIdで指定する
  channelId?: string;
};

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Expo Push APIへの送信に失敗しました: ${response.status} ${text}`);
  }
}
