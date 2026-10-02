import { useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useNotifyPreferencesStore } from '../../store/useNotifyPreferencesStore';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { fetchOpenPresenceLogs } from '../../lib/presence';
import { matchesSearchQuery } from '../../utils/search';
import { FriendsGroupsStackParamList, RootTabParamList } from '../../navigation/types';

// タブをまたいでマップ画面（絞り込み表示）へ直接遷移できるように、
// FriendsGroupsStackとRootTabの両方のnavigation型を合成する（MapScreen.tsxと対称のパターン）
type FriendsListNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<FriendsGroupsStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

type Props = {
  // 検索欄はFriendsGroupsListScreen側（セグメント切替の外側）に1つだけ配置する
  // ように変更したため（Issue #284）、検索語はこの画面の外からpropsで受け取る
  searchQuery: string;
};

export default function FriendsListScreen({ searchQuery }: Props) {
  const navigation = useNavigation<FriendsListNavigationProp>();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const status = useNotifyPreferencesStore((state) => state.status);
  const initialize = useNotifyPreferencesStore((state) => state.initialize);
  const friendships = useNotifyPreferencesStore((state) => state.friendships);
  const toggleNotifyEnabled = useNotifyPreferencesStore((state) => state.toggleNotifyEnabled);
  const toggleMuted = useNotifyPreferencesStore((state) => state.toggleMuted);
  const toggleLocationHidden = useNotifyPreferencesStore((state) => state.toggleLocationHidden);
  const removeFriend = useNotifyPreferencesStore((state) => state.removeFriend);
  // useFriendUsers自体もstatus==='idle'ならinitialize()を呼ぶため、
  // このスクリーンから先にマウントされた場合もここで取得が始まる
  const friends = useFriendUsers();
  // 名前の部分一致で絞り込む（Issue #251）。自分が既に参加している一覧を
  // クライアント側でフィルタするだけで、新規のDB・RLSは不要
  const visibleFriends = friends.filter((user) => matchesSearchQuery(user.name, searchQuery));
  // 「...」メニュー（ブロック・削除、Issue #276）の対象。選んだ友達のidを
  // 保持し、メニュー・削除確認の2段階モーダルをこのidの有無で出し分ける
  const [menuTargetId, setMenuTargetId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuTarget = friends.find((user) => user.id === menuTargetId) ?? null;
  const menuTargetFriendship = menuTargetId
    ? friendships.find((f) => f.friend_id === menuTargetId) ?? null
    : null;
  const deleteTarget = friends.find((user) => user.id === deleteConfirmId) ?? null;

  function handleToggleBlock() {
    if (!menuTargetId) return;
    toggleLocationHidden(menuTargetId);
    setMenuTargetId(null);
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await removeFriend(deleteConfirmId);
      setDeleteConfirmId(null);
      showToast('友達を削除しました');
    } catch (error) {
      console.error('removeFriend failed:', error);
      showToast('友達の削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  }

  // 行タップでその友達が現在在席しているエリアに絞ったマップへ遷移する（Issue #261）。
  // 在席中かどうかはpresence_logsの未退室（exited_at is null）行で判定する
  // （lib/presence.tsのfetchOpenPresenceLogsを流用、Issue #178で既にある処理の再利用）
  async function handlePressFriend(friendId: string, friendName: string) {
    try {
      const logs = await fetchOpenPresenceLogs(friendId);
      const areaId = logs[0]?.area_id ?? null;
      if (!areaId) {
        showToast(`${friendName}さんは現在在席していません`);
        return;
      }
      navigation.navigate('MapTab', { screen: 'Map', params: { filterAreaId: areaId, origin: 'friends' } });
    } catch (error) {
      console.error('fetchOpenPresenceLogs failed:', error);
      showToast('在席状況の取得に失敗しました');
    }
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <Screen style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>友達</Text>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>友達</Text>
        <ErrorState message="友達一覧の取得に失敗しました。" onRetry={initialize} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>友達</Text>

      {friends.length === 0 ? (
        <EmptyState icon="people-outline" message="まだ友達がいません" />
      ) : visibleFriends.length === 0 ? (
        <EmptyState icon="search-outline" message="該当する友達が見つかりません" />
      ) : (
        <FlatList
          data={visibleFriends}
          keyExtractor={(user) => user.id}
          renderItem={({ item: user }) => {
            const friendship = friendships.find((f) => f.friend_id === user.id);
            return (
              <ListItem
                title={user.name}
                onPress={() => handlePressFriend(user.id, user.name)}
                leading={<Avatar name={user.name} iconUrl={user.icon_url} />}
                trailing={
                  <View style={styles.trailingRow}>
                    {friendship ? (
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
                    ) : null}
                    <IconButton
                      name="ellipsis-vertical"
                      variant="secondary"
                      size={16}
                      accessibilityLabel={`${user.name}のメニュー`}
                      onPress={() => setMenuTargetId(user.id)}
                    />
                  </View>
                }
              />
            );
          }}
        />
      )}

      <Modal visible={menuTarget !== null} onClose={() => setMenuTargetId(null)} title={menuTarget?.name}>
        <Button
          label="詳細を見る"
          variant="secondary"
          onPress={() => {
            if (menuTargetId) navigation.navigate('FriendDetail', { friendId: menuTargetId });
            setMenuTargetId(null);
          }}
          style={styles.menuButton}
        />
        <Button
          label={menuTargetFriendship?.location_hidden ? 'ブロックを解除する' : 'ブロックする'}
          variant="secondary"
          onPress={handleToggleBlock}
          style={styles.menuButton}
        />
        <Button
          label="削除する"
          style={[styles.menuButton, { backgroundColor: colors.coral }]}
          onPress={() => {
            setDeleteConfirmId(menuTargetId);
            setMenuTargetId(null);
          }}
        />
      </Modal>

      <Modal
        visible={deleteTarget !== null}
        onClose={() => (deleting ? undefined : setDeleteConfirmId(null))}
        title="友達を削除しますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          {deleteTarget?.name}さんとの友達関係を解消します。この操作は取り消せません。再度友達になるには、OTPコードでの追加が必要です。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setDeleteConfirmId(null)}
            disabled={deleting}
            style={styles.modalButton}
          />
          <Button
            label={deleting ? '削除中…' : '削除する'}
            onPress={handleConfirmDelete}
            disabled={deleting}
            style={[styles.modalButton, { backgroundColor: colors.coral }]}
          />
        </View>
      </Modal>
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
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  menuButton: {
    marginBottom: spacing.sm,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
