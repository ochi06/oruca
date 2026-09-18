import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { ToastProvider } from './components/Toast';
import { DemoTabBar, DemoTab } from './components/DemoTabBar';

import PresenceScreen from './screens/PresenceScreen';
import GeofenceScreen from './screens/GeofenceScreen';
import AreaRegistrationScreen from './screens/AreaRegistrationScreen';
import FriendsScreen from './screens/friends/FriendsScreen';

// react-navigation導入前のデモ用画面切り替え（Issue #45）。
// US横断のreact-navigation導入時にこの一覧・切り替え処理は置き換える想定。
const DEMO_TABS: DemoTab[] = [
  { key: 'presence', label: '在席一覧', icon: 'people-outline' },
  { key: 'geofence', label: 'ジオフェンス', icon: 'location-outline' },
  { key: 'area', label: 'エリア登録', icon: 'map-outline' },
  { key: 'friends', label: '友達', icon: 'person-add-outline' },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
  });
  const [activeTab, setActiveTab] = useState<string>(DEMO_TABS[0].key);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <View style={styles.content}>
          {activeTab === 'presence' && <PresenceScreen />}
          {activeTab === 'geofence' && <GeofenceScreen />}
          {activeTab === 'area' && <AreaRegistrationScreen />}
          {activeTab === 'friends' && <FriendsScreen />}
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
