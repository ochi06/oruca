import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { Switch } from '../../components/Switch';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeModeStore, ThemeMode } from '../../store/useThemeModeStore';
import {
  deleteAccount,
  ensureSignedIn,
  fetchUserEntryVibrationEnabled,
  isCurrentSessionAnonymous,
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

// Issue #403：Issue #356でProfileScreenに統合していた詳細設定を、歯車アイコン
// 経由の別画面として再び分割した。プロフィール編集（アイコン・名前・ステータス・
// 滞在予定・ひとことメッセージ・匿名モード）はProfileScreen（タブのトップ）側
export default function SettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const themeMode = useThemeModeStore((state) => state.mode);
  const setThemeMode = useThemeModeStore((state) => state.setMode);
  const [state, setState] = useState<LoadState>('loading');
  const [entryVibrationEnabled, setEntryVibrationEnabled] = useState(true);
  // auth.uidの匿名セッション（signInAnonymously由来）かどうか。USERS.is_anonymous
  // （匿名モード設定、ProfileScreen側）とは別物（Issue #168）
  const [isAnonymousSession, setIsAnonymousSession] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then(async (userId) => {
        const [fetchedEntryVibrationEnabled, fetchedIsAnonymousSession] = await Promise.all([
          fetchUserEntryVibrationEnabled(userId),
          isCurrentSessionAnonymous(),
        ]);
        setEntryVibrationEnabled(fetchedEntryVibrationEnabled);
        setIsAnonymousSession(fetchedIsAnonymousSession);
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

  // アカウント削除（Issue #228、Apple 5.1.1(v)・Google Playのアカウント
  // 削除ポリシー対応）。成功するとApp.tsx側のonAuthStateChangeがSIGNED_OUTを
  // 検知し、自動でログイン画面に遷移する
  async function handleConfirmDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      // 成功後は画面自体がアンマウントされるため、ここでのstate更新は不要
    } catch (error) {
      console.error('deleteAccount failed:', error);
      setDeleting(false);
      setDeleteConfirmVisible(false);
      showToast('アカウントの削除に失敗しました');
    }
  }

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
        <ErrorState message="設定の取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} onBack={() => navigation.goBack()}>
      <ScrollView showsVerticalScrollIndicator={false}>
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

      {isAnonymousSession ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>アカウント</Text>
          <Button label="アカウント登録する" onPress={() => navigation.navigate('AccountUpgrade')} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>危険な操作</Text>
        <Button
          label="アカウントを削除する"
          variant="destructive"
          onPress={() => setDeleteConfirmVisible(true)}
        />
      </View>
      </ScrollView>

      <Modal
        visible={deleteConfirmVisible}
        onClose={() => (deleting ? undefined : setDeleteConfirmVisible(false))}
        title="アカウントを削除しますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          アカウントを削除すると、プロフィール・位置情報・友達関係・グループの
          参加状況など、すべてのデータが完全に削除されます。この操作は
          取り消せません。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setDeleteConfirmVisible(false)}
            disabled={deleting}
            style={styles.modalButton}
          />
          <Button
            label={deleting ? '削除中…' : '削除する'}
            variant="destructive"
            onPress={handleConfirmDeleteAccount}
            disabled={deleting}
            style={styles.modalButton}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.title,
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
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
