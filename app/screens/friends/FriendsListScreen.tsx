import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CURRENT_USER_ID, mockUsers } from '../../mocks/presence';
import { otherUser } from '../../mocks/otp';
import { useFriendAddStore } from '../../store/useFriendAddStore';
import { useNotifyPreferencesStore } from '../../store/useNotifyPreferencesStore';

type Props = {
  onAddFriend: () => void;
};

export default function FriendsListScreen({ onAddFriend }: Props) {
  const { colors } = useTheme();
  const addedFriendIds = useFriendAddStore((state) => state.addedFriendIds);
  const friendships = useNotifyPreferencesStore((state) => state.friendships);
  const toggleNotifyEnabled = useNotifyPreferencesStore((state) => state.toggleNotifyEnabled);

  const friendIds = friendships
    .filter((f) => f.user_id === CURRENT_USER_ID && f.status === 'active')
    .map((f) => f.friend_id);
  const allUsers = [...mockUsers, otherUser];
  const friends = [...friendIds, ...addedFriendIds]
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .map((id) => allUsers.find((user) => user.id === id))
    .filter((user): user is (typeof allUsers)[number] => user !== undefined);

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
                leading={<Avatar name={user.name} iconUrl={user.icon_url} />}
                trailing={
                  friendship ? (
                    <Switch
                      value={friendship.notify_enabled}
                      onValueChange={() => toggleNotifyEnabled(user.id)}
                      trackColor={{ true: colors.blue, false: colors.lightblue }}
                      accessibilityLabel={`${user.name}への入室通知`}
                    />
                  ) : null
                }
              />
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Button label="友達追加" onPress={onAddFriend} />
      </View>
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
  footer: {
    marginTop: spacing.md,
  },
});
