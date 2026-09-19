import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { ErrorState } from '../components/ErrorState';
import { ListItem } from '../components/ListItem';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { formatPresenceCount } from '../utils/format';
import { usePresenceStore } from '../store/usePresenceStore';
import { userStatusLabel } from '../constants/status';

export default function PresenceScreen() {
  const { colors } = useTheme();
  const { areaName, friends, presentCount, status, errorMessage, initialize } = usePresenceStore();

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'idle' || status === 'loading') {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen style={styles.container}>
        <ErrorState message={errorMessage ?? undefined} onRetry={initialize} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{areaName}</Text>
      <Text style={[styles.count, { color: colors.textSub }]}>
        {formatPresenceCount(presentCount)}
      </Text>

      <FlatList
        data={friends}
        keyExtractor={(friend) => friend.userId}
        renderItem={({ item: friend }) => (
          <ListItem
            title={friend.displayName ?? '非公開'}
            subtitle={userStatusLabel(friend.status) ?? undefined}
            leading={<Avatar name={friend.displayName ?? '?'} iconUrl={friend.iconUrl} />}
            trailing={
              <View
                style={[
                  styles.dot,
                  { backgroundColor: friend.isPresent ? colors.green : colors.textSub },
                ]}
              />
            }
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
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
