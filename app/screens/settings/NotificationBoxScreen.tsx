import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatTime } from '../../utils/format';
import { resolveUserName } from '../../utils/users';
import { isAnnouncementUnread } from '../../utils/announcements';
import { fetchUserNames } from '../../lib/auth';
import { fetchAreasByIds } from '../../lib/areas';
import { fetchAnnouncements } from '../../lib/announcements';
import { Notification } from '../../mocks/notifications';
import { Announcement } from '../../mocks/announcements';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useGroupStore } from '../../store/useGroupStore';
import { useAnnouncementsSeenStore } from '../../store/useAnnouncementsSeenStore';
import { SettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'NotificationBox'>;

// Issue #422: NOTIFICATIONSとANNOUNCEMENTSを時系列でマージして表示するための
// 表示用の1件
type DisplayItem =
  | { kind: 'notification'; createdAt: string; notification: Notification }
  | { kind: 'announcement'; createdAt: string; announcement: Announcement };

export default function NotificationBoxScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const notifications = useNotificationStore((state) => state.notifications);
  const status = useNotificationStore((state) => state.status);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const initialize = useNotificationStore((state) => state.initialize);
  const groups = useGroupStore((state) => state.groups);
  const groupMembers = useGroupStore((state) => state.members);
  // Issue #214: entry/want_to_meet/group_inviteのrelated_user_idの実際の名前
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  // Issue #420: area_link_proposedのarea_idの実際の名前。受け取る側が
  // そのエリアを監視していない場合、AREASのRLS上0件になりうる
  // （docs/must-manual-test-checklist.md「既知の制約」参照）。その場合は
  // フォールバック表示になる
  const [areaNameMap, setAreaNameMap] = useState<Map<string, string>>(new Map());
  // Issue #416: pull-to-refresh。initialize()はstatus==='loading'の間に
  // 全画面ローディング表示になるため、refreshing中はその分岐を迂回し、
  // ScrollView側のRefreshControlのインジケータのみ表示する
  const [refreshing, setRefreshing] = useState(false);
  // Issue #422: 運営からのお知らせ。NOTIFICATIONSとは別テーブルのため、
  // 別途取得してからマージする
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const lastSeenAnnouncementId = useAnnouncementsSeenStore((state) => state.lastSeenId);
  const markAnnouncementSeen = useAnnouncementsSeenStore((state) => state.markSeen);

  function loadAnnouncements() {
    fetchAnnouncements()
      .then(setAnnouncements)
      .catch(() => {
        // お知らせの取得に失敗しても通知ボックス自体は表示する
      });
  }

  useEffect(() => {
    initialize();
    loadAnnouncements();
  }, [initialize]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await initialize();
      loadAnnouncements();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const relatedUserIds = notifications
      .map((n) => n.related_user_id)
      .filter((id): id is string => id !== null && id !== undefined);
    if (relatedUserIds.length === 0) return;
    fetchUserNames(relatedUserIds)
      .then(setNameMap)
      .catch(() => {
        // 名前解決に失敗しても画面自体は表示する（フォールバック表示になる）
      });
  }, [notifications]);

  useEffect(() => {
    const areaIds = Array.from(
      new Set(
        notifications
          .filter((n) => n.type === 'area_link_proposed')
          .map((n) => n.area_id)
          .filter((id): id is string => id !== null && id !== undefined)
      )
    );
    if (areaIds.length === 0) return;
    fetchAreasByIds(areaIds)
      .then((areas) => setAreaNameMap(new Map(areas.map((area) => [area.id, area.name]))))
      .catch(() => {
        // 名前解決に失敗しても画面自体は表示する（フォールバック表示になる）
      });
  }, [notifications]);

  // NOTIFICATIONSとANNOUNCEMENTSを時系列（新しい順）でマージして表示する
  const items: DisplayItem[] = [
    ...notifications.map((notification): DisplayItem => ({
      kind: 'notification',
      createdAt: notification.created_at,
      notification,
    })),
    ...announcements.map((announcement): DisplayItem => ({
      kind: 'announcement',
      createdAt: announcement.created_at,
      announcement,
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function findGroupNameByMemberId(groupMemberId: string): string {
    const member = groupMembers.find((m) => m.id === groupMemberId);
    const group = member ? groups.find((g) => g.id === member.group_id) : undefined;
    return group?.name ?? '不明なグループ';
  }

  async function handleMarkAsRead(notificationId: string) {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error('markAsRead failed:', error);
      showToast('既読にできませんでした');
    }
  }

  function renderSingle(notification: Notification) {
    const time = formatTime(new Date(notification.created_at));
    let text: string;
    switch (notification.type) {
      case 'entry':
        text = `${resolveUserName(nameMap, notification.related_user_id!)}さんが入室しました（${time}）`;
        break;
      case 'want_to_meet':
        text = `会いたい人・${resolveUserName(nameMap, notification.related_user_id!)}さんが入室しました（${time}）`;
        break;
      case 'group_invite':
        text = `${resolveUserName(nameMap, notification.related_user_id!)}さんから「${findGroupNameByMemberId(notification.group_member_id!)}」に招待されました（${time}）`;
        break;
      case 'friend_added':
        text = `${resolveUserName(nameMap, notification.related_user_id!)}さんと友達になりました（${time}）`;
        break;
      case 'area_link_proposed':
        text = `${resolveUserName(nameMap, notification.related_user_id!)}さんから「${areaNameMap.get(notification.area_id!) ?? '不明なエリア'}」での紐づけを提案されました（${time}）`;
        break;
      default:
        text = `通知（${time}）`;
    }

    return (
      <ListItem
        key={notification.id}
        title={text}
        trailing={
          !notification.is_read ? (
            <Button label="既読にする" variant="secondary" onPress={() => handleMarkAsRead(notification.id)} />
          ) : undefined
        }
      />
    );
  }

  function renderAnnouncement(announcement: Announcement) {
    const time = formatTime(new Date(announcement.created_at));
    const unread = isAnnouncementUnread(announcement, announcements, lastSeenAnnouncementId);

    return (
      <ListItem
        key={announcement.id}
        title={`【お知らせ】${announcement.message}（${time}）`}
        leading={<Ionicons name="megaphone-outline" size={24} color={colors.textSub} />}
        trailing={
          unread ? (
            <Button
              label="既読にする"
              variant="secondary"
              onPress={() => markAnnouncementSeen(announcement.id)}
            />
          ) : undefined
        }
      />
    );
  }

  if ((status === 'loading' && !refreshing) || status === 'idle') {
    return (
      <Screen style={styles.container} onBack={() => navigation.goBack()}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.container} onBack={() => navigation.goBack()}>
        <ErrorState message="通知の取得に失敗しました。" onRetry={initialize} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <Text style={[styles.title, { color: colors.text }]}>通知ボックス</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={items.length === 0 ? styles.emptyContentContainer : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {items.length === 0 ? (
          <EmptyState icon="notifications-outline" message="通知はありません" />
        ) : (
          items.map((item) =>
            item.kind === 'announcement' ? renderAnnouncement(item.announcement) : renderSingle(item.notification)
          )
        )}
      </ScrollView>
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
  emptyContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
