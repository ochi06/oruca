import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CURRENT_USER_ID } from '../../mocks/presence';
import { useNotifyPreferencesStore } from '../../store/useNotifyPreferencesStore';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { FriendsGroupsStackParamList } from '../../navigation/types';

export default function FriendsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FriendsGroupsStackParamList>>();
  const { colors } = useTheme();
  const friendships = useNotifyPreferencesStore((state) => state.friendships);
  const toggleNotifyEnabled = useNotifyPreferencesStore((state) => state.toggleNotifyEnabled);
  const toggleMuted = useNotifyPreferencesStore((state) => state.toggleMuted);
  const friends = useFriendUsers();

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>友達</Text>

      {friends.length === 0 ? (
        <EmptyState icon="people-outline" message="まだ友達がいません" />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(user) => user.id}
          renderItem={({ item: user }) => {
            const friendship = friendships.find(
              (f) => f.user_id === CURRENT_USER_ID && f.friend_id === user.id
            );
            return (
              <ListItem
                title={user.name}
                onPress={() => navigation.navigate('FriendDetail', { friendId: user.id })}
                leading={<Avatar name={user.name} iconUrl={user.icon_url} />}
                trailing={
                  friendship ? (
                    <View style={styles.toggles}>
                      <View style={styles.toggleRow}>
                        <Text style={[styles.toggleLabel, { color: colors.textSub }]}>通知</Text>
                        <Switch
                          value={friendship.notify_enabled}
                          onValueChange={() => toggleNotifyEnabled(user.id)}
                          trackColor={{ true: colors.blue, false: colors.lightblue }}
                          accessibilityLabel={`${user.name}への入室通知`}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={[styles.toggleLabel, { color: colors.textSub }]}>ミュート</Text>
                        <Switch
                          value={friendship.muted}
                          onValueChange={() => toggleMuted(user.id)}
                          trackColor={{ true: colors.coral, false: colors.lightblue }}
                          accessibilityLabel={`${user.name}からの通知をミュート`}
                        />
                      </View>
                    </View>
                  ) : null
                }
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  toggles: {
    gap: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleLabel: {
    ...typography.caption,
  },
});
