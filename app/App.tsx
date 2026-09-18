import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { ToastProvider } from './components/Toast';
import { DemoTabBar, DemoTab } from './components/DemoTabBar';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ErrorState } from './components/ErrorState';
import { ensureSignedIn, ensureUserRow } from './lib/auth';

import PresenceScreen from './screens/PresenceScreen';
import GeofenceScreen from './screens/GeofenceScreen';
import FriendsScreen from './screens/friends/FriendsScreen';
import PresenceMapScreen from './screens/PresenceMapScreen';
import AreaJoinScreen from './screens/areas/AreaJoinScreen';

// react-navigation導入前のデモ用画面切り替え（Issue #45）。
// US横断のreact-navigation導入時にこの一覧・切り替え処理は置き換える想定。
// 「エリア登録」はマップタブ内のモード切り替えに統合したため、独立タブとしては
// 持たない（docs/architecture.md「3. 画面構成・ナビゲーション」参照、Issue #64）。
const DEMO_TABS: DemoTab[] = [
  { key: 'presence', label: '在席一覧', icon: 'people-outline' },
  { key: 'geofence', label: 'ジオフェンス', icon: 'location-outline' },
  { key: 'friends', label: '友達', icon: 'person-add-outline' },
  { key: 'map', label: 'マップ', icon: 'navigate-outline' },
  { key: 'area-join', label: 'エリア参加', icon: 'qr-code-outline' },
];

// プロフィール編集画面ができるまでの仮の初期表示名（別タスクで変更可能にする想定）。
const DEFAULT_USER_NAME = 'ゲスト';

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
  });
  const [activeTab, setActiveTab] = useState<string>(DEMO_TABS[0].key);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [signInError, setSignInError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    let cancelled = false;
    setSignInError(null);

    async function signIn() {
      try {
        const userId = await ensureSignedIn();
        await ensureUserRow(userId, DEFAULT_USER_NAME);
        if (!cancelled) {
          setIsSignedIn(true);
        }
      } catch (error) {
        console.error('signIn failed:', error);
        if (!cancelled) {
          setSignInError(error instanceof Error ? error : new Error('匿名ログインに失敗しました'));
        }
      }
    }

    signIn();

    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, retryCount]);

  if (!fontsLoaded) {
    return null;
  }

  if (signInError) {
    return (
      <SafeAreaProvider>
        <ErrorState
          message="ログインに失敗しました"
          onRetry={() => setRetryCount((count) => count + 1)}
        />
      </SafeAreaProvider>
    );
  }

  if (!isSignedIn) {
    return (
      <SafeAreaProvider>
        <LoadingIndicator />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <View style={styles.content}>
          {activeTab === 'presence' && <PresenceScreen />}
          {activeTab === 'geofence' && <GeofenceScreen />}
          {activeTab === 'friends' && <FriendsScreen />}
          {activeTab === 'map' && <PresenceMapScreen />}
          {activeTab === 'area-join' && <AreaJoinScreen />}
        </View>
        <DemoTabBar tabs={DEMO_TABS} activeKey={activeTab} onSelect={setActiveTab} />
        <StatusBar style="auto" />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
