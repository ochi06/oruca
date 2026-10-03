import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useGroupStore } from '../../store/useGroupStore';
import { Group } from '../../mocks/groups';
import { ensureSignedIn } from '../../lib/auth';
import { matchesSearchQuery } from '../../utils/search';
import { FriendsGroupsStackParamList, RootTabParamList } from '../../navigation/types';

// タブをまたいでマップ画面（絞り込み表示）へ直接遷移できるように、
// FriendsGroupsStackとRootTabの両方のnavigation型を合成する（MapScreen.tsxと対称のパターン）
type GroupsListNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<FriendsGroupsStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

type Props = {
  // 検索欄はFriendsGroupsListScreen側（セグメント切替の外側）に1つだけ配置する
  // ように変更したため（Issue #284）、検索語はこの画面の外からpropsで受け取る
  searchQuery: string;
};

export default function GroupsListScreen({ searchQuery }: Props) {
  const navigation = useNavigation<GroupsListNavigationProp>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const allGroups = useGroupStore((state) => state.groups);
  const members = useGroupStore((state) => state.members);
  const status = useGroupStore((state) => state.status);
  const initialize = useGroupStore((state) => state.initialize);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  // Issue #416: pull-to-refresh。initialize()はstatus==='loading'の間に
  // 全画面ローディング表示になるため、refreshing中はその分岐を迂回し、
  // FlatList側のRefreshControlのインジケータのみ表示する
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!userId) return;
    setRefreshing(true);
    try {
      await initialize(userId);
    } finally {
      setRefreshing(false);
    }
  }

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
  // 名前の部分一致で絞り込む（Issue #251）。自分が既に参加している一覧を
  // クライアント側でフィルタするだけで、新規のDB・RLSは不要
  const visibleGroups = groups.filter((group) => matchesSearchQuery(group.name, searchQuery));

  // 行タップでそのグループのエリアに絞ったマップへ遷移する（Issue #261）
  function handlePressGroup(group: Group) {
    if (!group.area_id) {
      showToast('このグループにはエリアが設定されていません');
      return;
    }
    navigation.navigate('MapTab', { screen: 'Map', params: { filterAreaId: group.area_id, origin: 'groups' } });
  }

  if (authError) {
    return (
      <Screen style={styles.container}>
        <ErrorState message="ログイン状態を確認できませんでした。" onRetry={loadUser} />
      </Screen>
    );
  }

  if ((status === 'loading' && !refreshing) || status === 'idle' || !userId) {
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

      <FlatList
        data={visibleGroups}
        keyExtractor={(group) => group.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon={groups.length === 0 ? 'people-circle-outline' : 'search-outline'}
            message={groups.length === 0 ? 'まだグループがありません' : '該当するグループが見つかりません'}
          />
        }
        renderItem={({ item: group }) => (
          <ListItem
            title={group.name}
            onPress={() => navigation.navigate('GroupDetail', { groupId: group.id })}
            trailing={
              <IconButton
                name="location-outline"
                variant="ghost"
                size={16}
                accessibilityLabel={`${group.name}のエリアをマップで見る`}
                onPress={() => handlePressGroup(group)}
              />
            }
          />
        )}
      />
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
