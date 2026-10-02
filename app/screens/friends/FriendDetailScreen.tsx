import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { ListItem } from '../../components/ListItem';
import { LocationHiddenToggle } from '../../components/LocationHiddenToggle';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { FriendScheduleNote } from '../../components/schedule/FriendScheduleNote';
import { useToast } from '../../components/Toast';
import { WantToMeetToggle } from '../../components/WantToMeetToggle';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useFriendUsers } from '../../hooks/useFriendUsers';
import { ensureSignedIn } from '../../lib/auth';
import { fetchMonitoredAreas } from '../../lib/areas';
import {
  approveFriendAreaLink,
  fetchMyFriendAreaLinks,
  proposeFriendAreaLink,
  rejectFriendAreaLink,
} from '../../lib/friendAreaLinks';
import { canProposeFriendAreaLink, resolveFriendAreaLinkState } from '../../utils/friendAreaLinks';
import { matchesSearchQuery } from '../../utils/search';
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

  function loadAreaLinks(signedInUserId: string) {
    Promise.all([fetchMonitoredAreas(signedInUserId), fetchMyFriendAreaLinks(signedInUserId)]).then(
      ([areas, fetchedLinks]) => {
        setMonitoredAreas(areas);
        setLinks(fetchedLinks);
      }
    );
  }

  useEffect(() => {
    ensureSignedIn().then((signedInUserId) => {
      setUserId(signedInUserId);
      loadAreaLinks(signedInUserId);
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
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Avatar name={friend.name} iconUrl={friend.icon_url} size={64} />
        <Text style={[styles.name, { color: colors.text }]}>{friend.name}</Text>
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
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
});
