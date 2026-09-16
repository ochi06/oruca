import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';
import { ToastProvider } from './components/Toast';

import PresenceScreen from './screens/PresenceScreen';

export default function App() {
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <PresenceScreen />
        <StatusBar style="auto" />
      </ToastProvider>
    </SafeAreaProvider>
  );
}
