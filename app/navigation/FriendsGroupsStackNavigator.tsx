import { createNativeStackNavigator } from '@react-navigation/native-stack';

import FriendsGroupsListScreen from '../screens/friends/FriendsGroupsListScreen';
import FriendDetailScreen from '../screens/friends/FriendDetailScreen';
import AddFriendScreen from '../screens/friends/AddFriendScreen';
import QrScanScreen from '../screens/friends/QrScanScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import GroupCreateScreen from '../screens/groups/GroupCreateScreen';
import GroupJoinScreen from '../screens/groups/GroupJoinScreen';
import GroupJoinRequestScreen from '../screens/groups/GroupJoinRequestScreen';
import { FriendsGroupsStackParamList } from './types';

const Stack = createNativeStackNavigator<FriendsGroupsStackParamList>();

export function FriendsGroupsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FriendsGroupsList" component={FriendsGroupsListScreen} />
      <Stack.Screen name="FriendDetail" component={FriendDetailScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="AddFriend" component={AddFriendScreen} />
      <Stack.Screen name="QrScan" component={QrScanScreen} />
      <Stack.Screen name="GroupCreate" component={GroupCreateScreen} />
      <Stack.Screen name="GroupJoin" component={GroupJoinScreen} />
      <Stack.Screen name="GroupJoinRequest" component={GroupJoinRequestScreen} />
    </Stack.Navigator>
  );
}
