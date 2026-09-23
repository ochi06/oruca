import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationBoxScreen from '../screens/settings/NotificationBoxScreen';
import { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsTop" component={SettingsScreen} />
      <Stack.Screen name="NotificationBox" component={NotificationBoxScreen} />
    </Stack.Navigator>
  );
}
