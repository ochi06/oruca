import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MapScreen from '../screens/map/MapScreen';
import PresenceListScreen from '../screens/map/PresenceListScreen';
import AreaRegistrationScreen from '../screens/map/AreaRegistrationScreen';
import AreaManagementScreen from '../screens/map/AreaManagementScreen';
import AreaEditScreen from '../screens/map/AreaEditScreen';
import { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

// 各画面が独自の「戻る」導線（IconButton/Button）を持っているため、
// ネイティブヘッダーは表示せずスワイプバックのみreact-navigationに任せる
export function MapStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={MapScreen} />
      <Stack.Screen name="PresenceList" component={PresenceListScreen} />
      <Stack.Screen name="AreaRegistration" component={AreaRegistrationScreen} />
      <Stack.Screen name="AreaManagement" component={AreaManagementScreen} />
      <Stack.Screen name="AreaEdit" component={AreaEditScreen} />
    </Stack.Navigator>
  );
}
