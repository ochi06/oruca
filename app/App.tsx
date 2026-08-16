import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansJP_400Regular, NotoSansJP_700Bold } from '@expo-google-fonts/noto-sans-jp';

import AreaRegistrationScreen from './screens/AreaRegistrationScreen';

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
      <AreaRegistrationScreen />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
