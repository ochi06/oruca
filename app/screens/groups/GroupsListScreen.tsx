import { FlatList, StyleSheet, Text } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useGroupStore } from '../../store/useGroupStore';

type Props = {
  onSelectGroup: (groupId: string) => void;
};

export default function GroupsListScreen({ onSelectGroup }: Props) {
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
            <ListItem title={group.name} onPress={() => onSelectGroup(group.id)} />
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
