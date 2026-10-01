import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

import { ensureSignedIn, fetchUserEntryVibrationEnabled, updateUserPushToken } from '../lib/auth';

// 通知の許可状態に関わらず、フォアグラウンドで受信した通知はOSの通知センターにも
// 表示する（デフォルトのまま何も設定しないと、フォアグラウンド中は無視されるため）。
// フォアグラウンド中のsound/振動はOS側では鳴らさず（shouldPlaySound: false）、
// 下記のNotifications.addNotificationReceivedListenerでexpo-hapticsを使い
// 明示的に振動させる（Issue #169。OS通知自体の振動とは別経路）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Issue #169：入室通知の振動あり/なしを切り替えるための通知チャンネル。
// supabase/functions/_shared/expoPush.tsのchannelIdと名前を揃えること
// （Android以外では無視される）
const ENTRY_VIBRATE_CHANNEL_ID = 'entry-vibrate';
const ENTRY_SILENT_CHANNEL_ID = 'entry-silent';

async function setupAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(ENTRY_VIBRATE_CHANNEL_ID, {
    name: '入室通知（振動あり）',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync(ENTRY_SILENT_CHANNEL_ID, {
    name: '入室通知（振動なし）',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0],
    enableVibrate: false,
  });
}

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
        await setupAndroidNotificationChannels();
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

    // Issue #169：フォアグラウンドで通知を受信した瞬間に、自分の
    // entry_vibration_enabled設定を見てexpo-hapticsで振動させる。
    // 毎回最新の設定値を取得する（設定画面でON/OFFを切り替えた直後にも
    // 反映されるようにするため、ここではキャッシュしない）
    const subscription = Notifications.addNotificationReceivedListener(() => {
      ensureSignedIn()
        .then((userId) => fetchUserEntryVibrationEnabled(userId))
        .then((vibrationEnabled) => {
          if (!cancelled && vibrationEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        })
        .catch(() => {
          // 振動の演出に失敗しても通知自体の受信・表示には影響させない
        });
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [enabled]);
}
