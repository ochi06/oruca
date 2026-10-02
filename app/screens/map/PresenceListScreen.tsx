import { FlatList, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatPresenceCount } from '../../utils/format';
import { userStatusLabel } from '../../constants/status';
import { usePresenceStore } from '../../store/usePresenceStore';
import { MapStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MapStackParamList, 'PresenceList'>;

// マップのポップアップ「もっと見る」から遷移するフルリスト（Issue #120）。
// 在席者一覧はusePresenceStoreから読む（Issue #308）ため、マップ画面で
// presence_logsのRealtime購読が動いている限り、この画面も自動で最新化される
export default function PresenceListScreen({ route, navigation }: Props) {
  const { areaName, areaId } = route.params;
  const users = usePresenceStore((s) => s.areaPresence[areaId] ?? []);
  const { colors } = useTheme();

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <Text style={[styles.title, { color: colors.text }]}>{areaName}</Text>
      <Text style={[styles.count, { color: colors.textSub }]}>
        {formatPresenceCount(users.length)}
      </Text>

      {users.length === 0 ? (
        <EmptyState icon="people-outline" message="在席中の人がいません" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(user) => user.userId}
          renderItem={({ item: user }) => (
            <ListItem
              title={user.displayName ?? '非公開'}
              subtitle={userStatusLabel(user.status) ?? undefined}
              leading={<Avatar name={user.displayName ?? '?'} iconUrl={user.iconUrl} />}
            />
          )}
        />
      )}
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
  count: {
    ...typography.body,
    marginBottom: spacing.md,
  },
});
