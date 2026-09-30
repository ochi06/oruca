import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LocationHiddenToggle } from '../../components/LocationHiddenToggle';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身はIssue #121（ブロック設定）のみ実装。滞在予定の閲覧（US-011）は
// 別Issueで別途追加する想定
type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'FriendDetail'>;

export default function FriendDetailScreen({ route, navigation }: Props) {
  const { friendId } = route.params;
  const { colors } = useTheme();
  const friends = useFriendUsers();
  const friend = friends.find((user) => user.id === friendId);

  if (!friend) {
    return (
      <Screen style={styles.container}>
        <EmptyState icon="person-outline" message="友達が見つかりません" />
        <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Button
        label="戻る"
        variant="secondary"
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      />

      <View style={styles.header}>
        <Avatar name={friend.name} iconUrl={friend.icon_url} size={64} />
        <Text style={[styles.name, { color: colors.text }]}>{friend.name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>プライバシー設定</Text>
        <LocationHiddenToggle friendId={friendId} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  name: {
    ...typography.title,
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
});
