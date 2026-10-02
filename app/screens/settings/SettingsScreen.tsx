import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AllowEntryNotificationsToggle } from '../../components/AllowEntryNotificationsToggle';
import { ErrorState } from '../../components/ErrorState';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeModeStore, ThemeMode } from '../../store/useThemeModeStore';
import { Button } from '../../components/Button';
import {
  deleteAccount,
  ensureSignedIn,
  fetchUserAllowEntryNotifications,
  fetchUserEntryVibrationEnabled,
  fetchUserIsAnonymous,
  isCurrentSessionAnonymous,
  updateUserAllowEntryNotifications,
  updateUserEntryVibrationEnabled,
  updateUserIsAnonymous,
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
export default function SettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const themeMode = useThemeModeStore((state) => state.mode);
  const setThemeMode = useThemeModeStore((state) => state.setMode);
  const [state, setState] = useState<LoadState>('loading');
  const [entryVibrationEnabled, setEntryVibrationEnabled] = useState(true);
  const [allowEntryNotifications, setAllowEntryNotifications] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  // auth.uidの匿名セッション（signInAnonymously由来）かどうか。USERS.is_anonymous
  // （匿名モード設定、上のisAnonymous）とは別物（Issue #168）
  const [isAnonymousSession, setIsAnonymousSession] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then(async (userId) => {
        const [
          fetchedEntryVibrationEnabled,
          fetchedAllowEntryNotifications,
          fetchedIsAnonymous,
          fetchedIsAnonymousSession,
        ] = await Promise.all([
          fetchUserEntryVibrationEnabled(userId),
          fetchUserAllowEntryNotifications(userId),
          fetchUserIsAnonymous(userId),
          isCurrentSessionAnonymous(),
        ]);
        setEntryVibrationEnabled(fetchedEntryVibrationEnabled);
        setAllowEntryNotifications(fetchedAllowEntryNotifications);
        setIsAnonymous(fetchedIsAnonymous);
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

  // 「会いたい人」への入室通知の許可ワンタップ切替（US-017、Issue #243）
  async function handleToggleAllowEntryNotifications() {
    const nextValue = !allowEntryNotifications;
    setAllowEntryNotifications(nextValue);
    try {
      const userId = await ensureSignedIn();
      await updateUserAllowEntryNotifications(userId, nextValue);
    } catch (error) {
      console.error('updateUserAllowEntryNotifications failed:', error);
      setAllowEntryNotifications(!nextValue);
      showToast('設定の更新に失敗しました');
    }
  }

  // 匿名モードのワンタップ切替（US-013、Issue #184）。ONの間、承認済みの
  // 友達にも名前・在席が見えなくなる（可視性の絞り込み自体はMapScreen側）
  async function handleToggleAnonymous() {
    const nextValue = !isAnonymous;
    setIsAnonymous(nextValue);
    try {
      const userId = await ensureSignedIn();
      await updateUserIsAnonymous(userId, nextValue);
    } catch (error) {
      console.error('updateUserIsAnonymous failed:', error);
      setIsAnonymous(!nextValue);
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
        <AllowEntryNotificationsToggle
          value={allowEntryNotifications}
          onValueChange={handleToggleAllowEntryNotifications}
        />
      </View>

      {isAnonymousSession ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>アカウント</Text>
          <Button label="アカウント登録する" onPress={() => navigation.navigate('AccountUpgrade')} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>匿名モード</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>匿名モード</Text>
            <Text style={[styles.toggleSubLabel, { color: colors.textSub }]}>
              ONの間、友達にも名前・在席が表示されません
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={handleToggleAnonymous}
            trackColor={{ true: colors.blue, false: colors.lightblue }}
            accessibilityLabel="匿名モード"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>危険な操作</Text>
        <Button
          label="アカウントを削除する"
          variant="secondary"
          onPress={() => setDeleteConfirmVisible(true)}
          style={{ backgroundColor: colors.coral }}
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
            onPress={handleConfirmDeleteAccount}
            disabled={deleting}
            style={[styles.modalButton, { backgroundColor: colors.coral }]}
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
  toggleTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
  },
  toggleSubLabel: {
    ...typography.caption,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
