import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatTime } from '../../utils/format';
import { findUserName } from '../../utils/users';
import { Notification } from '../../mocks/notifications';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useGroupStore } from '../../store/useGroupStore';
import { SettingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'NotificationBox'>;

// 表示用にまとめた1件。arrival_summaryは同じarea_id×created_atの行を
// 複数まとめて1枚のカードにする（Issue #126で決めた粒度：会える人1人＝1行）
type DisplayItem =
  | { kind: 'arrival_group'; key: string; createdAt: string; areaId: string; notifications: Notification[] }
  | { kind: 'single'; key: string; createdAt: string; notification: Notification };

function groupNotifications(notifications: Notification[]): DisplayItem[] {
  const arrivalGroups = new Map<string, Notification[]>();
  const items: DisplayItem[] = [];

  for (const notification of notifications) {
    if (notification.type === 'arrival_summary') {
      const key = `${notification.area_id}|${notification.created_at}`;
      const existing = arrivalGroups.get(key);
      if (existing) {
        existing.push(notification);
      } else {
        arrivalGroups.set(key, [notification]);
      }
    } else {
      items.push({ kind: 'single', key: notification.id, createdAt: notification.created_at, notification });
    }
  }

  for (const [key, groupedNotifications] of arrivalGroups) {
    items.push({
      kind: 'arrival_group',
      key,
      createdAt: groupedNotifications[0].created_at,
      areaId: groupedNotifications[0].area_id!,
      notifications: groupedNotifications,
    });
  }

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export default function NotificationBoxScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const groups = useGroupStore((state) => state.groups);
  const groupMembers = useGroupStore((state) => state.members);

  const items = groupNotifications(notifications);

  function findGroupNameByMemberId(groupMemberId: string): string {
    const member = groupMembers.find((m) => m.id === groupMemberId);
    const group = member ? groups.find((g) => g.id === member.group_id) : undefined;
    return group?.name ?? '不明なグループ';
  }

  function renderSingle(notification: Notification) {
    const time = formatTime(new Date(notification.created_at));
    let text: string;
    switch (notification.type) {
      case 'entry':
        text = `${findUserName(notification.related_user_id!)}さんが入室しました（${time}）`;
        break;
      case 'want_to_meet':
        text = `会いたい人・${findUserName(notification.related_user_id!)}さんが入室しました（${time}）`;
        break;
      case 'group_invite':
        text = `${findUserName(notification.related_user_id!)}さんから「${findGroupNameByMemberId(notification.group_member_id!)}」に招待されました（${time}）`;
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
            <Button label="既読にする" variant="secondary" onPress={() => markAsRead(notification.id)} />
          ) : undefined
        }
      />
    );
  }

  function renderArrivalGroup(item: Extract<DisplayItem, { kind: 'arrival_group' }>) {
    const unreadIds = item.notifications.filter((n) => !n.is_read).map((n) => n.id);
    const time = formatTime(new Date(item.createdAt));

    return (
      <View key={item.key} style={styles.summaryCard}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>
          入室しました（{time}）・今会える人
        </Text>
        {item.notifications.map((notification) => (
          <ListItem
            key={notification.id}
            title={findUserName(notification.related_user_id!)}
            leading={<Avatar name={findUserName(notification.related_user_id!)} iconUrl={null} />}
          />
        ))}
        {unreadIds.length > 0 && (
          <Button
            label="既読にする"
            variant="secondary"
            onPress={() => unreadIds.forEach(markAsRead)}
            style={styles.markReadButton}
          />
        )}
      </View>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>通知ボックス</Text>

      {items.length === 0 ? (
        <EmptyState icon="notifications-outline" message="通知はありません" />
      ) : (
        items.map((item) => (item.kind === 'arrival_group' ? renderArrivalGroup(item) : renderSingle(item.notification)))
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
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  markReadButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  backButton: {
    marginTop: spacing.md,
  },
});
