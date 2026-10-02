import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { ListItem } from '../../components/ListItem';
import { LocationHiddenToggle } from '../../components/LocationHiddenToggle';
import { Modal } from '../../components/Modal';
import { ProfileHeader } from '../../components/ProfileHeader';
import { Screen } from '../../components/Screen';
import { FriendScheduleNote } from '../../components/schedule/FriendScheduleNote';
import { useToast } from '../../components/Toast';
import { WantToMeetToggle } from '../../components/WantToMeetToggle';
import {
  WANT_TO_MEET_BADGE_HIT_SLOP,
  WANT_TO_MEET_BADGE_ICON_SIZE,
  WANT_TO_MEET_BADGE_SIZE,
} from '../../constants/wantToMeetBadge';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useNotifyPreferencesStore } from '../../store/useNotifyPreferencesStore';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { ensureSignedIn } from '../../lib/auth';
import { fetchMonitoredAreas } from '../../lib/areas';
import {
  approveFriendAreaLink,
  fetchMyFriendAreaLinks,
  proposeFriendAreaLink,
  rejectFriendAreaLink,
} from '../../lib/friendAreaLinks';
import { fetchAllVisibleAreaSchedules, fetchAllVisibleAreaScheduleOverrides } from '../../lib/schedules';
import { canProposeFriendAreaLink, resolveFriendAreaLinkState } from '../../utils/friendAreaLinks';
import { matchesSearchQuery } from '../../utils/search';
import { friendIdsWithVisibleNotes } from '../../utils/schedules';
import { todayDateString } from '../../utils/format';
import { Area } from '../../mocks/areas';
import { FriendAreaLink } from '../../mocks/presence';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身はIssue #121（ブロック設定）・Issue #221（エリア紐づけの提案・承認）・
// Issue #242（会いたい人登録・滞在予定表示の組み込み。共在時のみ通知は
// Issue #270で個別トグルを廃止し常時適用のルールに統合されたため対象外）
type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'FriendDetail'>;

export default function FriendDetailScreen({ route, navigation }: Props) {
  const { friendId } = route.params;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const friends = useFriendUsers();
  const friend = friends.find((user) => user.id === friendId);
  const [userId, setUserId] = useState<string | null>(null);
  const [monitoredAreas, setMonitoredAreas] = useState<Area[]>([]);
  const [links, setLinks] = useState<FriendAreaLink[]>([]);
  const [busyAreaId, setBusyAreaId] = useState<string | null>(null);
  // エリア紐づけの追加ピッカー（Issue #272）。まだ紐づけ状態のない
  // （resolveFriendAreaLinkStateが'none'の）エリアのみを検索・選択できる
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  // 「…」メニュー（ブロック・削除、Issue #276）
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const friendship = useNotifyPreferencesStore((state) =>
    state.friendships.find((f) => f.friend_id === friendId)
  );
  const toggleLocationHidden = useNotifyPreferencesStore((state) => state.toggleLocationHidden);
  const toggleWantToMeet = useNotifyPreferencesStore((state) => state.toggleWantToMeet);
  const removeFriend = useNotifyPreferencesStore((state) => state.removeFriend);
  // 滞在予定・ステータスメッセージが設定されているか（Issue #274）。一覧画面と
  // 同じ判定を使い、見た目・意味を整合させる
  const [friendIdsWithNotes, setFriendIdsWithNotes] = useState<Set<string>>(new Set());

  function handleToggleBlock() {
    toggleLocationHidden(friendId);
    setIsMenuVisible(false);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await removeFriend(friendId);
      showToast('友達を削除しました');
      navigation.goBack();
    } catch (error) {
      console.error('removeFriend failed:', error);
      setDeleting(false);
      setIsDeleteConfirmVisible(false);
      showToast('友達の削除に失敗しました');
    }
  }

  function loadAreaLinks(signedInUserId: string) {
    Promise.all([fetchMonitoredAreas(signedInUserId), fetchMyFriendAreaLinks(signedInUserId)]).then(
      ([areas, fetchedLinks]) => {
        setMonitoredAreas(areas);
        setLinks(fetchedLinks);
      }
    );
  }

  useEffect(() => {
    ensureSignedIn().then(async (signedInUserId) => {
      setUserId(signedInUserId);
      loadAreaLinks(signedInUserId);
      const today = todayDateString(new Date());
      const [schedules, overrides] = await Promise.all([
        fetchAllVisibleAreaSchedules(),
        fetchAllVisibleAreaScheduleOverrides(today),
      ]);
      setFriendIdsWithNotes(friendIdsWithVisibleNotes(signedInUserId, schedules, overrides));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePropose(areaId: string) {
    if (!userId) return;
    setBusyAreaId(areaId);
    try {
      await proposeFriendAreaLink(userId, friendId, areaId);
      loadAreaLinks(userId);
      setIsPickerVisible(false);
      setPickerQuery('');
      showToast('エリアの紐づけを提案しました');
    } catch {
      showToast('提案に失敗しました');
    } finally {
      setBusyAreaId(null);
    }
  }

  async function handleApprove(linkId: string, areaId: string) {
    if (!userId) return;
    setBusyAreaId(areaId);
    try {
      await approveFriendAreaLink(linkId);
      loadAreaLinks(userId);
      showToast('エリアの紐づけを承認しました');
    } catch {
      showToast('承認に失敗しました');
    } finally {
      setBusyAreaId(null);
    }
  }

  async function handleReject(linkId: string, areaId: string) {
    if (!userId) return;
    setBusyAreaId(areaId);
    try {
      await rejectFriendAreaLink(linkId);
      loadAreaLinks(userId);
      showToast('提案を拒否しました');
    } catch {
      showToast('拒否に失敗しました');
    } finally {
      setBusyAreaId(null);
    }
  }

  if (!friend) {
    return (
      <Screen style={styles.container} onBack={() => navigation.goBack()}>
        <EmptyState icon="person-outline" message="友達が見つかりません" />
      </Screen>
    );
  }

  // 既に何らかの紐づけ状態があるエリアのみ通常表示し（Issue #272）、
  // まだ紐づけ状態のない（'none'の）エリアは「追加」ピッカー側に回す
  const areaStates = userId === null ? [] : monitoredAreas.map((area) => ({
    area,
    state: resolveFriendAreaLinkState(links, userId, friendId, area.id),
  }));
  const linkedAreas = areaStates.filter(({ state }) => state.kind !== 'none');
  const pickableAreas = areaStates.filter(({ state }) => state.kind === 'none').map(({ area }) => area);

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()} onMenu={() => setIsMenuVisible(true)}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <ProfileHeader
        name={friend.name}
        iconUrl={friend.icon_url}
        bottomLeftBadge={
          friendship ? (
            <Pressable
              onPress={() => toggleWantToMeet(friendId)}
              hitSlop={WANT_TO_MEET_BADGE_HIT_SLOP}
              style={styles.heartBadge}
              accessibilityLabel={
                friendship.want_to_meet ? '会いたい人から外す' : '会いたい人に登録'
              }
            >
              <Ionicons
                name={friendship.want_to_meet ? 'heart' : 'heart-outline'}
                size={WANT_TO_MEET_BADGE_ICON_SIZE}
                color={colors.coral}
              />
            </Pressable>
          ) : undefined
        }
        topRightBadge={
          friendIdsWithNotes.has(friendId) ? (
            <View style={[styles.noteBadge, { backgroundColor: colors.surface, borderColor: colors.blue }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={10} color={colors.blue} />
            </View>
          ) : undefined
        }
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>プライバシー設定</Text>
        <LocationHiddenToggle friendId={friendId} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知設定</Text>
        <WantToMeetToggle friendId={friendId} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>エリアの紐づけ</Text>
          {userId !== null && (
            <Button
              label="追加"
              variant="secondary"
              onPress={() => setIsPickerVisible(true)}
              style={styles.addButton}
            />
          )}
        </View>
        <Text style={[styles.sectionCaption, { color: colors.textSub }]}>
          紐づけを承認したエリアでは、お互いに名前つきで在席・滞在予定が見えるようになります
        </Text>
        {userId === null ? null : linkedAreas.length === 0 ? (
          <EmptyState icon="location-outline" message="紐づけ中のエリアがありません" />
        ) : (
          linkedAreas.map(({ area, state }) => {
            const busy = busyAreaId === area.id;
            let trailing: ReactNode;
            if (state.kind === 'approved') {
              trailing = <Text style={{ color: colors.textSub }}>紐づけ済み</Text>;
            } else if (state.kind === 'pending_sent') {
              trailing = <Text style={{ color: colors.textSub }}>承認待ち</Text>;
            } else if (state.kind === 'pending_received') {
              trailing = (
                <View style={styles.actions}>
                  <Button
                    label="承認"
                    onPress={() => handleApprove(state.link.id, area.id)}
                    disabled={busy}
                    style={styles.actionButton}
                  />
                  <Button
                    label="拒否"
                    variant="secondary"
                    onPress={() => handleReject(state.link.id, area.id)}
                    disabled={busy}
                    style={styles.actionButton}
                  />
                </View>
              );
            } else if (state.kind === 'rejected_by_them') {
              trailing = <Text style={{ color: colors.textSub }}>拒否されました</Text>;
            } else if (canProposeFriendAreaLink(state)) {
              trailing = (
                <Button
                  label="提案する"
                  onPress={() => handlePropose(area.id)}
                  disabled={busy}
                  style={styles.actionButton}
                />
              );
            }
            return (
              <View key={area.id}>
                <ListItem title={area.name} trailing={trailing} />
                <FriendScheduleNote friendId={friendId} areaId={area.id} />
              </View>
            );
          })
        )}
      </View>
      </ScrollView>

      <Modal
        visible={isPickerVisible}
        onClose={() => {
          setIsPickerVisible(false);
          setPickerQuery('');
        }}
        title="エリアを追加"
      >
        {pickableAreas.length > 0 && (
          <Input
            style={styles.searchInput}
            value={pickerQuery}
            onChangeText={setPickerQuery}
            placeholder="名前で検索"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        {pickableAreas.length === 0 ? (
          <EmptyState icon="location-outline" message="追加できるエリアがありません" />
        ) : (
          (() => {
            const visiblePickableAreas = pickableAreas.filter((area) =>
              matchesSearchQuery(area.name, pickerQuery)
            );
            return visiblePickableAreas.length === 0 ? (
              <EmptyState icon="search-outline" message="該当するエリアが見つかりません" />
            ) : (
              visiblePickableAreas.map((area) => (
                <ListItem
                  key={area.id}
                  title={area.name}
                  trailing={
                    <Button
                      label="提案する"
                      onPress={() => handlePropose(area.id)}
                      disabled={busyAreaId === area.id}
                      style={styles.actionButton}
                    />
                  }
                />
              ))
            );
          })()
        )}
      </Modal>

      <Modal visible={isMenuVisible} onClose={() => setIsMenuVisible(false)} title={friend.name}>
        <Button
          label={friendship?.location_hidden ? 'ブロックを解除する' : 'ブロックする'}
          variant="secondary"
          onPress={handleToggleBlock}
          style={styles.menuButton}
        />
        <Button
          label="削除する"
          style={[styles.menuButton, { backgroundColor: colors.coral }]}
          onPress={() => {
            setIsMenuVisible(false);
            setIsDeleteConfirmVisible(true);
          }}
        />
      </Modal>

      <Modal
        visible={isDeleteConfirmVisible}
        onClose={() => (deleting ? undefined : setIsDeleteConfirmVisible(false))}
        title="友達を削除しますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          {friend.name}さんとの友達関係を解消します。この操作は取り消せません。再度友達になるには、OTPコードでの追加が必要です。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setIsDeleteConfirmVisible(false)}
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
  heartBadge: {
    width: WANT_TO_MEET_BADGE_SIZE,
    height: WANT_TO_MEET_BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    paddingHorizontal: spacing.md,
  },
  sectionCaption: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    marginBottom: spacing.sm,
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
