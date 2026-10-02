import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn } from '../../lib/auth';
import { fetchMonitoredAreas } from '../../lib/areas';
import { Area } from '../../mocks/areas';
import { SettingsStackParamList } from '../../navigation/types';

type LoadState = 'loading' | 'loaded' | 'error';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ScheduleAreaList'>;

// プロフィール画面の「滞在予定」導線（Issue #244、US-011）。自分が監視中の
// 全エリア（USER_AREAS、所有エリアに限らない）を一覧表示し、タップした先で
// そのエリアのScheduleEditForm（既存・バックエンド接続済み）を表示する
export default function ScheduleAreaListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<LoadState>('loading');
  const [areas, setAreas] = useState<Area[]>([]);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then((userId) => fetchMonitoredAreas(userId))
      .then((result) => {
        setAreas(result);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }

  useEffect(() => {
    load();
  }, []);

  if (state === 'loading') {
    return (
      <Screen style={styles.container} onBack={() => navigation.goBack()}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen style={styles.container} onBack={() => navigation.goBack()}>
        <ErrorState message="エリア一覧の取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <Text style={[styles.title, { color: colors.text }]}>滞在予定</Text>

      {areas.length === 0 ? (
        <EmptyState icon="calendar-outline" message="参加しているエリアがまだありません" />
      ) : (
        <FlatList
          data={areas}
          keyExtractor={(area) => area.id}
          renderItem={({ item: area }) => (
            <ListItem
              title={area.name}
              onPress={() => navigation.navigate('ScheduleEdit', { areaId: area.id, areaName: area.name })}
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
    marginBottom: spacing.md,
  },
});
