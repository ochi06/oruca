import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { usePresenceStore } from '../store/usePresenceStore';

// Issue #309（US-003統合分）：アプリをバックグラウンドから復帰させた場合
// （画面遷移を伴わない場合）に在席データを再取得する。presence_logsの
// Realtime購読（Issue #308）だけでは、モバイルOSがバックグラウンド中に
// ソケットを切断し、復帰後の再接続が完了するまでの間に発生した変更を
// 取りこぼす可能性があるため、復帰時の明示的な再取得を安全策として用意する。
// MapScreen・PresenceListScreenはどちらもusePresenceStoreを参照しているため、
// ここでの再取得が両画面に反映される。
// enabledはログイン完了前に無駄なフェッチを走らせないためのガード
// （useGeofenceMonitorと同じ方針）
export function usePresenceAppStateRefresh(enabled: boolean): void {
  const loadPresence = usePresenceStore((state) => state.load);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const cameToForeground = appStateRef.current.match(/inactive|background/) && nextState === 'active';
      appStateRef.current = nextState;
      if (cameToForeground) {
        loadPresence({ silent: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, loadPresence]);
}
