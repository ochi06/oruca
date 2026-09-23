import { FlatList, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useGroupStore } from '../../store/useGroupStore';
import { FriendsGroupsStackParamList } from '../../navigation/types';

export default function GroupsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FriendsGroupsStackParamList>>();
  const { colors } = useTheme();
  const groups = useGroupStore((state) => state.groups);

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>グループ</Text>

      {groups.length === 0 ? (
        <EmptyState icon="people-circle-outline" message="まだグループがありません" />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.id}
          renderItem={({ item: group }) => (
            <ListItem
              title={group.name}
              onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
            />
          )}
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
});
