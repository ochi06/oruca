import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WebMapPlaceholderScreen from '../screens/map/WebMapPlaceholderScreen';
import { MapStackParamList } from './types';

const Stack = createNativeStackNavigator<MapStackParamList>();

// Issue #190: Web簡易体験版向け。react-native-mapsがWeb非対応のため、
// マップ関連画面（エリア登録・管理・編集・在席者一覧）は一切マウントせず、
// 案内画面のみを出す。Metroのプラットフォーム解決により、Webバンドル時は
// このファイルがnavigation/MapStackNavigator.tsxの代わりに使われる
export function MapStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Map" component={WebMapPlaceholderScreen} />
    </Stack.Navigator>
  );
}
