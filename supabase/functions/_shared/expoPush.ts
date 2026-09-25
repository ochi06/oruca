// Expo Push Service（https://exp.host/--/api/v2/push/send）への送信ヘルパー。
// 1リクエストあたり最大100件までまとめて送れる仕様のため、呼び出し側で
// チャンク分割してから渡す想定（このプロジェクトの規模ではまず超えない）。

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
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
