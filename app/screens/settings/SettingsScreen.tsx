import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { ProfileHeader, ProfileHeaderHandle } from '../../components/ProfileHeader';
import { Screen } from '../../components/Screen';
import { Switch } from '../../components/Switch';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeModeStore, ThemeMode } from '../../store/useThemeModeStore';
import { USER_STATUS_OPTIONS, UserStatus, userStatusIcon } from '../../constants/status';
import {
  DEFAULT_USER_NAME,
  deleteAccount,
  ensureSignedIn,
  fetchUserEntryVibrationEnabled,
  fetchUserIconUrl,
  fetchUserIsAnonymous,
  fetchUserName,
  fetchUserStatus,
  isCurrentSessionAnonymous,
  updateUserEntryVibrationEnabled,
  updateUserIcon,
  updateUserIsAnonymous,
  updateUserName,
  updateUserStatus,
} from '../../lib/auth';
import { SettingsStackParamList } from '../../navigation/types';

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'system', label: 'システムに従う' },
];

type LoadState = 'loading' | 'loaded' | 'error';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ProfileTop'>;

// Issue #356：プロフィール編集（アイコン・名前・ステータス）と詳細設定
// （テーマ・入室通知・匿名モード等）を1画面に統合した（Issue #176の方針転換）。
// タブのトップ画面として表示するため、戻るボタンは持たない。
// Issue #362：アイコン・名前の変更は、アバター上のボタンではなく右上の⋮メニュー
// 経由にした。ステータスはアバター右下の丸バッジ化し、タップでモーダル選択する
export default function SettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const themeMode = useThemeModeStore((state) => state.mode);
  const setThemeMode = useThemeModeStore((state) => state.setMode);
  const profileHeaderRef = useRef<ProfileHeaderHandle>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [name, setName] = useState(DEFAULT_USER_NAME);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [entryVibrationEnabled, setEntryVibrationEnabled] = useState(true);
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
          fetchedName,
          fetchedIconUrl,
          fetchedStatus,
          fetchedEntryVibrationEnabled,
          fetchedIsAnonymous,
          fetchedIsAnonymousSession,
        ] = await Promise.all([
          fetchUserName(userId),
          fetchUserIconUrl(userId),
          fetchUserStatus(userId),
          fetchUserEntryVibrationEnabled(userId),
          fetchUserIsAnonymous(userId),
          isCurrentSessionAnonymous(),
        ]);
        setName(fetchedName ?? DEFAULT_USER_NAME);
        setIconUrl(fetchedIconUrl);
        setStatus(fetchedStatus);
        setEntryVibrationEnabled(fetchedEntryVibrationEnabled);
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

  // ワンタップで切り替える。既に選択中の項目をもう一度タップした場合は
  // 未設定（null）に戻す（Issue #10「ワンタップ切替UI」）
  async function handleSelectStatus(value: UserStatus) {
    const nextStatus = status === value ? null : value;
    const previousStatus = status;
    setStatus(nextStatus);
    setStatusModalVisible(false);
    setUpdatingStatus(true);
    try {
      const userId = await ensureSignedIn();
      await updateUserStatus(userId, nextStatus);
    } catch (error) {
      console.error('updateUserStatus failed:', error);
      setStatus(previousStatus);
      showToast('ステータスの更新に失敗しました');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSaveName(trimmed: string) {
    try {
      const userId = await ensureSignedIn();
      await updateUserName(userId, trimmed);
      setName(trimmed);
      showToast('名前を更新しました');
    } catch (error) {
      console.error('updateUserName failed:', error);
      showToast('名前の更新に失敗しました');
      throw error;
    }
  }

  async function handleChangeIcon() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('写真ライブラリへのアクセスを許可してください');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    try {
      const userId = await ensureSignedIn();
      const newIconUrl = await updateUserIcon(userId, asset.uri);
      setIconUrl(newIconUrl);
      showToast('アイコンを更新しました');
    } catch (error) {
      console.error('updateUserIcon failed:', error);
      showToast('アイコンの更新に失敗しました');
    }
  }

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
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen style={styles.container}>
        <ErrorState message="プロフィールの取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  const currentStatusIcon = status ? userStatusIcon(status) : null;

  return (
    <Screen style={styles.container} onMenu={() => setMenuVisible(true)}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>プロフィール</Text>
        <View style={styles.headerIcons}>
          <IconButton
            name="calendar-outline"
            variant="secondary"
            accessibilityLabel="滞在予定"
            onPress={() => navigation.navigate('ScheduleAreaList')}
          />
          <IconButton
            name="notifications-outline"
            variant="secondary"
            accessibilityLabel="通知ボックス"
            onPress={() => navigation.navigate('NotificationBox')}
          />
        </View>
      </View>
      <ProfileHeader
        ref={profileHeaderRef}
        name={name}
        iconUrl={iconUrl}
        editable
        onSaveName={handleSaveName}
        bottomRightBadge={
          <Pressable
            onPress={() => setStatusModalVisible(true)}
            disabled={updatingStatus}
            style={[styles.statusBadge, { backgroundColor: colors.surface, borderColor: colors.blue }]}
            accessibilityLabel="ステータスを変更する"
          >
            <Ionicons
              name={currentStatusIcon ?? 'ellipse-outline'}
              size={14}
              color={currentStatusIcon ? colors.blue : colors.textSub}
            />
          </Pressable>
        }
      />

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
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>匿名モード</Text>
        <Text style={[styles.toggleSubLabel, { color: colors.textSub, marginBottom: spacing.sm }]}>
          ONの間、友達にも名前・在席が表示されません
        </Text>
        <Button
          label={isAnonymous ? '匿名モードを解除' : '匿名モードにする'}
          variant="secondary"
          onPress={handleToggleAnonymous}
          style={[
            styles.anonymousButton,
            isAnonymous
              ? {
                  backgroundColor: colors.sand,
                  shadowColor: colors.sand,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 12,
                  elevation: 8,
                }
              : { backgroundColor: colors.lightblue },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>危険な操作</Text>
        <Button
          label="アカウントを削除する"
          variant="destructive"
          onPress={() => setDeleteConfirmVisible(true)}
        />
      </View>
      </ScrollView>

      <Modal visible={menuVisible} onClose={() => setMenuVisible(false)} title="プロフィールを編集">
        <Button
          label="アイコンを変更する"
          variant="secondary"
          onPress={() => {
            setMenuVisible(false);
            handleChangeIcon();
          }}
          style={styles.menuButton}
        />
        <Button
          label="名前を変更する"
          variant="secondary"
          onPress={() => {
            setMenuVisible(false);
            profileHeaderRef.current?.startEditingName();
          }}
          style={styles.menuButton}
        />
      </Modal>

      <Modal visible={statusModalVisible} onClose={() => setStatusModalVisible(false)} title="ステータス">
        {USER_STATUS_OPTIONS.map((option) => (
          <ListItem
            key={option.value}
            title={option.label}
            leading={<Ionicons name={option.icon} size={20} color={colors.text} />}
            trailing={status === option.value ? <Ionicons name="checkmark" size={20} color={colors.blue} /> : undefined}
            onPress={() => handleSelectStatus(option.value)}
          />
        ))}
      </Modal>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
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
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Issue #359：匿名モードは使う頻度・とっさ性が高いため、他の設定項目とは
  // 別格の大きいボタンにする。ON時はcolors.sand背景+シャドウで光るような
  // 強調表現にする（developer指示・司令塔チャットで方針確認済み）
  anonymousButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
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
  menuButton: {
    marginBottom: spacing.sm,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
