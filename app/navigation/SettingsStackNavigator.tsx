import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/settings/ProfileScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationBoxScreen from '../screens/settings/NotificationBoxScreen';
import AccountUpgradeScreen from '../screens/settings/AccountUpgradeScreen';
import ScheduleAreaListScreen from '../screens/settings/ScheduleAreaListScreen';
import ScheduleEditScreen from '../screens/settings/ScheduleEditScreen';
import { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileTop" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="NotificationBox" component={NotificationBoxScreen} />
      <Stack.Screen name="AccountUpgrade" component={AccountUpgradeScreen} />
      <Stack.Screen name="ScheduleAreaList" component={ScheduleAreaListScreen} />
      <Stack.Screen name="ScheduleEdit" component={ScheduleEditScreen} />
    </Stack.Navigator>
  );
}
