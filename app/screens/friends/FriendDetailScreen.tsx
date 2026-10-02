import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { LocationHiddenToggle } from '../../components/LocationHiddenToggle';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
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
import { Area } from '../../mocks/areas';
import { FriendAreaLink } from '../../mocks/presence';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身はIssue #121（ブロック設定）・Issue #221（エリア紐づけの提案・承認）。
// 滞在予定の閲覧（US-011）は別Issueで別途追加する想定
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>エリアの紐づけ</Text>
        <Text style={[styles.sectionCaption, { color: colors.textSub }]}>
          紐づけを承認したエリアでは、お互いに名前つきで在席・滞在予定が見えるようになります
        </Text>
        {userId === null ? null : monitoredAreas.length === 0 ? (
          <EmptyState icon="location-outline" message="監視中のエリアがありません" />
        ) : (
          monitoredAreas.map((area) => {
            const state = resolveFriendAreaLinkState(links, userId, friendId, area.id);
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
            return <ListItem key={area.id} title={area.name} trailing={trailing} />;
          })
        )}
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
});
