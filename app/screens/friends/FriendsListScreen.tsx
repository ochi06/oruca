import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  WANT_TO_MEET_BADGE_HIT_SLOP,
  WANT_TO_MEET_BADGE_ICON_SIZE,
  WANT_TO_MEET_BADGE_SIZE,
} from '../../constants/wantToMeetBadge';
import { isWantToMeetLimitError, useNotifyPreferencesStore } from '../../store/useNotifyPreferencesStore';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { ensureSignedIn } from '../../lib/auth';
import { fetchMonitoredAreas } from '../../lib/areas';
import { fetchMyFriendAreaLinks, proposeFriendAreaLink } from '../../lib/friendAreaLinks';
import { fetchOpenPresenceLogs } from '../../lib/presence';
import { fetchAllVisibleAreaSchedules, fetchAllVisibleAreaScheduleOverrides } from '../../lib/schedules';
import { canProposeFriendAreaLink, resolveFriendAreaLinkState } from '../../utils/friendAreaLinks';
import { matchesSearchQuery } from '../../utils/search';
import { friendIdsWithVisibleNotes } from '../../utils/schedules';
import { todayDateString } from '../../utils/format';
import { Area } from '../../mocks/areas';
import { FriendAreaLink } from '../../mocks/presence';
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
  const toggleLocationHidden = useNotifyPreferencesStore((state) => state.toggleLocationHidden);
  const toggleWantToMeet = useNotifyPreferencesStore((state) => state.toggleWantToMeet);
  const removeFriend = useNotifyPreferencesStore((state) => state.removeFriend);
  // useFriendUsers自体もstatus==='idle'ならinitialize()を呼ぶため、
  // このスクリーンから先にマウントされた場合もここで取得が始まる
  const friends = useFriendUsers();
  // 滞在予定・ステータスメッセージが設定されている友達のidセット（Issue #274）。
  // エリアを問わず自分が閲覧できる全件をRLSに任せて取得し、クライアント側で
  // 空文字を除外して判定する
  const [friendIdsWithNotes, setFriendIdsWithNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    ensureSignedIn().then(async (currentUserId) => {
      const today = todayDateString(new Date());
      const [schedules, overrides] = await Promise.all([
        fetchAllVisibleAreaSchedules(),
        fetchAllVisibleAreaScheduleOverrides(today),
      ]);
      setFriendIdsWithNotes(friendIdsWithVisibleNotes(currentUserId, schedules, overrides));
    });
  }, []);
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

  // 複数の友達を選んでまとめてエリア紐づけを提案する（Issue #245、Issue #221の拡張）。
  // 1対1の提案・承認ロジック（proposeFriendAreaLink・resolveFriendAreaLinkState）は
  // そのまま流用し、選択した友達それぞれに対して提案してよいか（まだ提案していない・
  // 相手の拒否を受けていない）を判定してから一括で提案する
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [monitoredAreas, setMonitoredAreas] = useState<Area[]>([]);
  const [links, setLinks] = useState<FriendAreaLink[]>([]);
  const [isAreaPickerVisible, setIsAreaPickerVisible] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [proposing, setProposing] = useState(false);

  function handleToggleSelectionMode() {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
      return;
    }
    setSelectionMode(true);
    ensureSignedIn().then((signedInUserId) => {
      setUserId(signedInUserId);
      Promise.all([fetchMonitoredAreas(signedInUserId), fetchMyFriendAreaLinks(signedInUserId)]).then(
        ([areas, fetchedLinks]) => {
          setMonitoredAreas(areas);
          setLinks(fetchedLinks);
        }
      );
    });
  }

  function handleToggleSelected(friendId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }

  async function handleBulkPropose(area: Area) {
    if (!userId || selectedIds.size === 0) return;
    setProposing(true);
    try {
      const eligibleIds = Array.from(selectedIds).filter((friendId) =>
        canProposeFriendAreaLink(resolveFriendAreaLinkState(links, userId, friendId, area.id))
      );
      await Promise.all(eligibleIds.map((friendId) => proposeFriendAreaLink(userId, friendId, area.id)));
      const skippedCount = selectedIds.size - eligibleIds.length;
      setIsAreaPickerVisible(false);
      setPickerQuery('');
      setSelectionMode(false);
      setSelectedIds(new Set());
      if (eligibleIds.length === 0) {
        showToast('選択した全員が提案済み・紐づけ済みのため、提案できませんでした');
      } else if (skippedCount > 0) {
        showToast(`${eligibleIds.length}人に提案しました（${skippedCount}人は提案済みのためスキップ）`);
      } else {
        showToast(`${eligibleIds.length}人に提案しました`);
      }
    } catch (error) {
      console.error('bulk proposeFriendAreaLink failed:', error);
      showToast('提案に失敗しました');
    } finally {
      setProposing(false);
    }
  }

  function handleToggleBlock() {
    if (!menuTargetId) return;
    toggleLocationHidden(menuTargetId);
    setMenuTargetId(null);
  }

  // 会いたい人は5人まで（Issue #330、DBトリガーで強制）
  async function handleToggleWantToMeet(friendId: string) {
    try {
      await toggleWantToMeet(friendId);
    } catch (error) {
      showToast(isWantToMeetLimitError(error) ? '会いたい人は5人まで登録できます' : '操作に失敗しました');
    }
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
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>友達</Text>
        {friends.length > 0 && (
          <IconButton
            name={selectionMode ? 'close-outline' : 'checkbox-outline'}
            variant="secondary"
            accessibilityLabel={selectionMode ? '選択モードを終了' : '複数選択してエリアを提案'}
            onPress={handleToggleSelectionMode}
          />
        )}
      </View>

      {selectionMode && selectedIds.size > 0 && (
        <View style={styles.selectionBar}>
          <Text style={[typography.body, { color: colors.text }]}>{selectedIds.size}人を選択中</Text>
          <Button
            label="エリアを提案する"
            onPress={() => setIsAreaPickerVisible(true)}
            style={styles.selectionButton}
          />
        </View>
      )}

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
            const isSelected = selectedIds.has(user.id);
            if (selectionMode) {
              return (
                <ListItem
                  title={user.name}
                  onPress={() => handleToggleSelected(user.id)}
                  leading={<Avatar name={user.name} iconUrl={user.icon_url} />}
                  trailing={
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.blue : colors.textSub}
                    />
                  }
                />
              );
            }
            const hasNote = friendIdsWithNotes.has(user.id);
            return (
              <ListItem
                title={user.name}
                onPress={() => handlePressFriend(user.id, user.name)}
                leading={
                  <View style={styles.avatarWrapper}>
                    <Avatar name={user.name} iconUrl={user.icon_url} />
                    {friendship ? (
                      <Pressable
                        onPress={() => handleToggleWantToMeet(user.id)}
                        hitSlop={WANT_TO_MEET_BADGE_HIT_SLOP}
                        style={styles.heartBadge}
                        accessibilityLabel={
                          friendship.want_to_meet
                            ? `${user.name}を会いたい人から外す`
                            : `${user.name}を会いたい人に登録`
                        }
                      >
                        <Ionicons
                          name={friendship.want_to_meet ? 'heart' : 'heart-outline'}
                          size={WANT_TO_MEET_BADGE_ICON_SIZE}
                          color={colors.coral}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                }
                trailing={
                  <View style={styles.trailingRow}>
                    {hasNote ? (
                      <View accessibilityLabel={`${user.name}の滞在予定あり`}>
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textSub} />
                      </View>
                    ) : null}
                    <IconButton
                      name="ellipsis-vertical"
                      variant="ghost"
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
          variant="destructive"
          style={styles.menuButton}
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
            variant="destructive"
            onPress={handleConfirmDelete}
            disabled={deleting}
            style={styles.modalButton}
          />
        </View>
      </Modal>

      <Modal
        visible={isAreaPickerVisible}
        onClose={() => {
          setIsAreaPickerVisible(false);
          setPickerQuery('');
        }}
        title="エリアを選んで提案する"
      >
        {monitoredAreas.length > 0 && (
          <Input
            style={styles.searchInput}
            value={pickerQuery}
            onChangeText={setPickerQuery}
            placeholder="名前で検索"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        {monitoredAreas.length === 0 ? (
          <EmptyState icon="location-outline" message="参加しているエリアがありません" />
        ) : (
          (() => {
            const visibleAreas = monitoredAreas.filter((area) => matchesSearchQuery(area.name, pickerQuery));
            return visibleAreas.length === 0 ? (
              <EmptyState icon="search-outline" message="該当するエリアが見つかりません" />
            ) : (
              visibleAreas.map((area) => (
                <ListItem
                  key={area.id}
                  title={area.name}
                  trailing={
                    <Button
                      label="提案する"
                      onPress={() => handleBulkPropose(area)}
                      disabled={proposing}
                      style={styles.actionButton}
                    />
                  }
                />
              ))
            );
          })()
        )}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  selectionButton: {
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    marginBottom: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrapper: {
    position: 'relative',
  },
  heartBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: WANT_TO_MEET_BADGE_SIZE,
    height: WANT_TO_MEET_BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
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
