import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Input } from '../../components/Input';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn } from '../../lib/auth';
import { useGroupStore } from '../../store/useGroupStore';
import { FriendsGroupsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoinRequest'>;

// 公開グループを検索して参加を申請する画面（Issue #119）。
// AreaRegistrationScreenの既存エリア検索（名前の部分一致）と同じ考え方。
// Issue #117「グループ参加」（招待の承諾）とは別の導線
export default function GroupJoinRequestScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const groups = useGroupStore((state) => state.groups);
  const myMemberGroupIds = useGroupStore(
    useShallow((state) =>
      new Set(
        state.members
          .filter((m) => m.user_id === userId && m.status !== 'rejected')
          .map((m) => m.group_id)
      )
    )
  );
  const requestToJoinGroup = useGroupStore((state) => state.requestToJoinGroup);
  const initialize = useGroupStore((state) => state.initialize);

  function loadUser() {
    setAuthError(false);
    ensureSignedIn()
      .then(setUserId)
      .catch(() => setAuthError(true));
  }

  useEffect(() => {
    initialize();
    loadUser();
  }, [initialize]);

  if (authError) {
    return (
      <Screen style={styles.container}>
        <ErrorState message="ログイン状態を確認できませんでした。" onRetry={loadUser} />
      </Screen>
    );
  }

  const searchResults = groups.filter(
    (group) =>
      group.is_public &&
      !myMemberGroupIds.has(group.id) &&
      searchQuery.length > 0 &&
      group.name.includes(searchQuery)
  );

  async function handleRequest(groupId: string, groupName: string) {
    if (!userId) return;
    const result = await requestToJoinGroup(groupId, userId);
    if (result.status === 'already_member') {
      showToast('既に参加申請済み、またはメンバーです');
      return;
    }
    if (result.status === 'success') {
      showToast(`「${groupName}」に参加を申請しました`);
    }
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>グループ参加申請</Text>
      <Input
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="グループ名で検索"
        autoFocus
      />

      {searchQuery.length === 0 ? (
        <EmptyState icon="search-outline" message="グループ名を入力して検索してください" />
      ) : searchResults.length === 0 ? (
        <EmptyState icon="search-outline" message="該当する公開グループが見つかりません" />
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(group) => group.id}
          renderItem={({ item: group }) => (
            <ListItem
              title={group.name}
              trailing={
                <Button label="参加を申請する" onPress={() => handleRequest(group.id, group.name)} />
              }
            />
          )}
        />
      )}

      <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton} />
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
  backButton: {
    marginTop: spacing.md,
  },
});
