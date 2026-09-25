import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { ensureSignedIn, updateUserPushToken } from '../lib/auth';

// 通知の許可状態に関わらず、フォアグラウンドで受信した通知はOSの通知センターにも
// 表示する（デフォルトのまま何も設定しないと、フォアグラウンド中は無視されるため）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  // 実機以外（シミュレーター・一部のエミュレーター）ではPushトークンを取得できない
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // EASプロジェクトが紐付いていない場合はprojectIdが取得できず、
  // getExpoPushTokenAsyncが失敗するため事前にガードする
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token;
}

// ログイン完了後、Pushトークンを取得してUSERS.push_tokenに保存する（Issue #131）。
// enabledはログイン完了前に通知許可を要求してしまわないためのガード
// （useGeofenceMonitorと同じ方針）
export function usePushNotificationRegistration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function register() {
      try {
        const userId = await ensureSignedIn();
        const token = await registerForPushNotifications();
        if (!cancelled && token) {
          await updateUserPushToken(userId, token);
        }
      } catch {
        // Pushトークンの登録に失敗しても、アプリ本体の機能は継続させる
        // （在席可視化・位置情報監視には影響しない）
      }
    }

    register();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
