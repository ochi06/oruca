import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
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
import { fetchUserNames } from '../../lib/auth';
import { Notification } from '../../mocks/notifications';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useGroupStore } from '../../store/useGroupStore';
import { SettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'NotificationBox'>;

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
  // Issue #416: pull-to-refresh。initialize()はstatus==='loading'の間に
  // 全画面ローディング表示になるため、refreshing中はその分岐を迂回し、
  // ScrollView側のRefreshControlのインジケータのみ表示する
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await initialize();
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

  // 新しい順に表示する
  const items = [...notifications].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

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
          items.map((notification) => renderSingle(notification))
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
