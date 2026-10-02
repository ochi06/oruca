import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { ToastProvider } from './components/Toast';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ErrorState } from './components/ErrorState';
import { WebDemoNotice } from './components/WebDemoNotice';
import { DEFAULT_USER_NAME, ensureUserRow } from './lib/auth';
import { initSentry, Sentry } from './lib/sentry';
import { supabase } from './lib/supabase';
import { useGeofenceMonitor } from './hooks/useGeofenceMonitor';
import { usePushNotificationRegistration } from './hooks/usePushNotificationRegistration';
import { RootTabNavigator } from './navigation/RootTabNavigator';
import { useOnboardingStore } from './store/useOnboardingStore';

import LoginScreen from './screens/LoginScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// モジュール読み込み時（起動直後）に初期化する（Issue #27）。
// App関数コンポーネント内で呼ぶと、再レンダリングのたびに呼ばれる・
// 初期化前のクラッシュを捕捉できないため、ここで一度だけ行う
initSentry();

function App() {
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
  });
  // undefined＝起動直後でまだ判定中、null＝未ログイン
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [signInError, setSignInError] = useState<Error | null>(null);
  // 初回起動時のオンボーディング（Issue #246）。未ログインの間だけ、まだ
  // 見ていなければLoginScreenの前に挟む。hasHydratedがtrueになるまでは
  // AsyncStorageからの読み込み中なので、ローディング扱いにする
  const hasSeenOnboarding = useOnboardingStore((state) => state.hasSeenOnboarding);
  const hasOnboardingHydrated = useOnboardingStore((state) => state.hasHydrated);
  const markOnboardingSeen = useOnboardingStore((state) => state.markOnboardingSeen);

  // ログイン完了後は、どのタブを表示していても常時マウントされるApp本体から
  // 呼び出すことで、タブ切り替えによるアンマウントで監視が止まらないようにする
  useGeofenceMonitor(!!userId);
  // 同じ理由で、Pushトークンの登録も常時マウントされるApp本体から呼び出す（Issue #131）
  usePushNotificationRegistration(!!userId);

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

  if (userId === undefined || !hasOnboardingHydrated) {
    return (
      <SafeAreaProvider>
        <LoadingIndicator />
      </SafeAreaProvider>
    );
  }

  if (userId === null) {
    if (!hasSeenOnboarding) {
      return (
        <SafeAreaProvider>
          <OnboardingScreen onDone={markOnboardingSeen} />
        </SafeAreaProvider>
      );
    }
    return (
      <SafeAreaProvider>
        <WebDemoNotice />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <WebDemoNotice />
        <NavigationContainer>
          <RootTabNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrapで包むことで、レンダー中の未捕捉エラーもクラッシュとして
// 報告される（Issue #27）。ただしSentry.wrap自体はinitSentry()の成否に
// 関わらず無条件でSentry内部状態を参照するため、DSN未設定（＝initSentry()が
// Sentry.init()を呼んでいない）の開発環境でwrapすると
// 「Sentry.wrap was called before Sentry.init」という警告が出る（実害は無いが、
// 開発中のログが煩わしい。Issue #174）。DSNが設定されている場合のみwrapする
export default process.env.EXPO_PUBLIC_SENTRY_DSN ? Sentry.wrap(App) : App;
