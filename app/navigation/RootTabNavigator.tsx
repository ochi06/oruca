import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/useTheme';
import { MapStackNavigator } from './MapStackNavigator';
import { FriendsGroupsStackNavigator } from './FriendsGroupsStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  MapTab: 'navigate-outline',
  FriendsGroupsTab: 'people-outline',
  SettingsTab: 'settings-outline',
};

export function RootTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.textSub,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.textSub },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name as keyof RootTabParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="MapTab" component={MapStackNavigator} options={{ title: 'マップ' }} />
      <Tab.Screen
        name="FriendsGroupsTab"
        component={FriendsGroupsStackNavigator}
        options={{ title: '友達・グループ' }}
      />
      <Tab.Screen name="SettingsTab" component={SettingsStackNavigator} options={{ title: '設定' }} />
    </Tab.Navigator>
  );
}
