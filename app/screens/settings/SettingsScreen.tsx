import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ErrorState } from '../../components/ErrorState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeModeStore, ThemeMode } from '../../store/useThemeModeStore';
import { Button } from '../../components/Button';
import {
  ensureSignedIn,
  fetchUserEntryVibrationEnabled,
  updateUserEntryVibrationEnabled,
} from '../../lib/auth';
import { SettingsStackParamList } from '../../navigation/types';

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'system', label: 'システムに従う' },
];

type LoadState = 'loading' | 'loaded' | 'error';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

// Issue #176: docs/architecture.md（2026-09-27決定）通り、プロフィール画面の
// 歯車アイコンから遷移する詳細設定画面。何を置くかは未確定（docs L185）だが、
// 現時点では表示モード・入室通知の振動設定を置く
export default function SettingsScreen({}: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const themeMode = useThemeModeStore((state) => state.mode);
  const setThemeMode = useThemeModeStore((state) => state.setMode);
  const [state, setState] = useState<LoadState>('loading');
  const [entryVibrationEnabled, setEntryVibrationEnabled] = useState(true);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then(async (userId) => {
        const fetchedEntryVibrationEnabled = await fetchUserEntryVibrationEnabled(userId);
        setEntryVibrationEnabled(fetchedEntryVibrationEnabled);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }

  useEffect(() => {
    load();
  }, []);

  // 入室通知の振動ON/OFF（Issue #169）
  async function handleToggleEntryVibration() {
    const nextValue = !entryVibrationEnabled;
    setEntryVibrationEnabled(nextValue);
    try {
      const userId = await ensureSignedIn();
      await updateUserEntryVibrationEnabled(userId, nextValue);
    } catch (error) {
      console.error('updateUserEntryVibrationEnabled failed:', error);
      setEntryVibrationEnabled(!nextValue);
      showToast('設定の更新に失敗しました');
    }
  }

  if (state === 'loading') {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen style={styles.container}>
        <ErrorState message="設定の取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>設定</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>表示モード</Text>
        <View style={styles.options}>
          {THEME_MODE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant={themeMode === option.value ? 'primary' : 'secondary'}
              onPress={() => setThemeMode(option.value)}
              style={styles.chip}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>入室通知</Text>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>通知時に振動する</Text>
          <Switch
            value={entryVibrationEnabled}
            onValueChange={handleToggleEntryVibration}
            trackColor={{ true: colors.blue, false: colors.lightblue }}
            accessibilityLabel="入室通知の振動"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    ...typography.body,
  },
});
