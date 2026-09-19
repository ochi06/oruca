import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { ToastProvider } from './components/Toast';
import { DemoTabBar, DemoTab } from './components/DemoTabBar';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ErrorState } from './components/ErrorState';
import { DEFAULT_USER_NAME, ensureUserRow } from './lib/auth';
import { supabase } from './lib/supabase';
import { useGeofenceMonitor } from './hooks/useGeofenceMonitor';

import LoginScreen from './screens/LoginScreen';
import PresenceScreen from './screens/PresenceScreen';
import FriendsScreen from './screens/friends/FriendsScreen';
import GroupsScreen from './screens/groups/GroupsScreen';
import PresenceMapScreen from './screens/PresenceMapScreen';
import AreaJoinScreen from './screens/areas/AreaJoinScreen';
import AreaManagementScreen from './screens/areas/AreaManagementScreen';
import ProfileScreen from './screens/ProfileScreen';

// react-navigation導入前のデモ用画面切り替え（Issue #45）。
// US横断のreact-navigation導入時にこの一覧・切り替え処理は置き換える想定。
// 「エリア登録」はマップタブ内のモード切り替えに統合したため、独立タブとしては
// 持たない（docs/architecture.md「3. 画面構成・ナビゲーション」参照、Issue #64）。
// 「ジオフェンス」タブも在席一覧・エリア参加・マップと表示が重複するため
// 独立タブとしては持たず、位置監視ロジックのみuseGeofenceMonitorとして
// ログイン後常時実行する（Issue #73）。
const DEMO_TABS: DemoTab[] = [
  { key: 'presence', label: '在席一覧', icon: 'people-outline' },
  { key: 'friends', label: '友達', icon: 'person-add-outline' },
  { key: 'groups', label: 'グループ', icon: 'people-circle-outline' },
  { key: 'map', label: 'マップ', icon: 'navigate-outline' },
  { key: 'area-join', label: 'エリア参加', icon: 'qr-code-outline' },
  { key: 'area-management', label: 'エリア管理', icon: 'settings-outline' },
  { key: 'profile', label: 'プロフィール', icon: 'person-circle-outline' },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
  });
  const [activeTab, setActiveTab] = useState<string>(DEMO_TABS[0].key);
  // undefined＝起動直後でまだ判定中、null＝未ログイン
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [signInError, setSignInError] = useState<Error | null>(null);

  // ログイン完了後は、どのタブを表示していても常時マウントされるApp本体から
  // 呼び出すことで、タブ切り替えによるアンマウントで監視が止まらないようにする
  useGeofenceMonitor(!!userId);

  // ログイン状態の監視（ADR-0010）。起動時の既存セッション確認と、以後の
  // ログイン・ログアウトの両方をこのリスナー1つでまとめて扱う
  // （supabase-jsは購読直後に現在のセッション状態を1回通知してくれる）。
  // ログイン完了自体はLoginScreen側でverifyOtpを呼んだ時点で成立し、それが
  // SIGNED_INイベントとしてここに通知される（ディープリンクは使わない）
  useEffect(() => {
    let cancelled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (!session) {
        setUserId(null);
        return;
      }

      ensureUserRow(session.user.id, DEFAULT_USER_NAME)
        .then(() => {
          if (!cancelled) setUserId(session.user.id);
        })
        .catch((error) => {
          if (!cancelled) {
            setSignInError(error instanceof Error ? error : new Error('ログインに失敗しました'));
          }
        });
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  if (signInError) {
    return (
      <SafeAreaProvider>
        <ErrorState
          message="ログインに失敗しました"
          onRetry={() => setSignInError(null)}
        />
      </SafeAreaProvider>
    );
  }

  if (userId === undefined) {
    return (
      <SafeAreaProvider>
        <LoadingIndicator />
      </SafeAreaProvider>
    );
  }

  if (userId === null) {
    return (
      <SafeAreaProvider>
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <View style={styles.content}>
          {activeTab === 'presence' && <PresenceScreen />}
          {activeTab === 'friends' && <FriendsScreen />}
          {activeTab === 'groups' && <GroupsScreen />}
          {activeTab === 'map' && <PresenceMapScreen />}
          {activeTab === 'area-join' && <AreaJoinScreen />}
          {activeTab === 'area-management' && <AreaManagementScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
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
