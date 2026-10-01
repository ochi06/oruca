import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useGroupStore } from '../../store/useGroupStore';
import { ensureSignedIn } from '../../lib/auth';
import { FriendsGroupsStackParamList } from '../../navigation/types';

export default function GroupsListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<FriendsGroupsStackParamList>>();
  const { colors } = useTheme();
  const allGroups = useGroupStore((state) => state.groups);
  const members = useGroupStore((state) => state.members);
  const status = useGroupStore((state) => state.status);
  const initialize = useGroupStore((state) => state.initialize);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  function loadUser() {
    setAuthError(false);
    ensureSignedIn()
      .then(setUserId)
      .catch(() => setAuthError(true));
  }

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const load = () => initialize(userId);
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, initialize, userId]);

  // 自分がapproved（または管理者）なグループのみ表示する。leaveGroup/removeMemberは
  // membersからしか行を消さないため、ここで絞り込まないと退会後もグループが
  // 表示され続けてしまう（Issue #134）
  const myGroupIds = new Set(
    members
      .filter((m) => m.user_id === userId && m.status === 'approved')
      .map((m) => m.group_id)
  );
  const groups = allGroups.filter(
    (group) => group.owner_user_id === userId || myGroupIds.has(group.id)
  );

  if (authError) {
    return (
      <Screen style={styles.container}>
        <ErrorState message="ログイン状態を確認できませんでした。" onRetry={loadUser} />
      </Screen>
    );
  }

  if (status === 'loading' || status === 'idle' || !userId) {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.container}>
        <ErrorState message="グループの取得に失敗しました。" onRetry={initialize} />
      </Screen>
    );
  }

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
