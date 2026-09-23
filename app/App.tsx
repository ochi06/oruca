import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { ToastProvider } from './components/Toast';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ErrorState } from './components/ErrorState';
import { DEFAULT_USER_NAME, ensureUserRow } from './lib/auth';
import { supabase } from './lib/supabase';
import { useGeofenceMonitor } from './hooks/useGeofenceMonitor';
import { RootTabNavigator } from './navigation/RootTabNavigator';

import LoginScreen from './screens/LoginScreen';

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
  });
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
        <NavigationContainer>
          <RootTabNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </ToastProvider>
    </SafeAreaProvider>
  );
}
