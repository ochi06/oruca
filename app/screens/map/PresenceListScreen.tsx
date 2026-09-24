import { FlatList, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/Avatar';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatPresenceCount } from '../../utils/format';
import { userStatusLabel } from '../../constants/status';
import { MapStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MapStackParamList, 'PresenceList'>;

// マップのポップアップ「もっと見る」から遷移するフルリスト（Issue #120）。
// マップ画面が取得済みのそのエリアの在席者一覧をそのまま表示するため、
// この画面自体は再フェッチせず、開いた時点のスナップショット表示になる
// （Realtimeでの自動更新はされない。再度マップに戻ってタップし直せば最新化される）
export default function PresenceListScreen({ route }: Props) {
  const { areaName, users } = route.params;
  const { colors } = useTheme();

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{areaName}</Text>
      <Text style={[styles.count, { color: colors.textSub }]}>
        {formatPresenceCount(users.length)}
      </Text>

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
