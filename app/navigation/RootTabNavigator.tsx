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
  SettingsTab: 'person-outline',
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
      <Tab.Screen
        name="FriendsGroupsTab"
        component={FriendsGroupsStackNavigator}
        options={{ title: '友達・グループ' }}
      />
      <Tab.Screen
        name="MapTab"
        component={MapStackNavigator}
        options={{ title: 'マップ' }}
        // Issue #280: 友達/グループ一覧からの絞り込み遷移（filterAreaId/origin）は
        // route.paramsに乗るが、React Navigationのタブナビゲータはタブ切り替えだけでは
        // 自動的にparamsをクリアしない。そのため一度絞り込み経由で開くと、以後タブを
        // 普通にタップしただけでも戻るボタン・絞り込みが残り続けてしまっていた。
        // タブボタンを直接タップした時（プログラムからのnavigateとは別のtabPress）だけ、
        // 明示的にparamsをクリアする
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('MapTab', {
              screen: 'Map',
              params: { filterAreaId: undefined, origin: undefined },
            });
          },
        })}
      />
      <Tab.Screen name="SettingsTab" component={SettingsStackNavigator} options={{ title: 'プロフィール' }} />
    </Tab.Navigator>
  );
}
