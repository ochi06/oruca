import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { ProfileNotesSection } from '../../components/schedule/ProfileNotesSection';
import { Screen } from '../../components/Screen';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { USER_STATUS_OPTIONS, UserStatus } from '../../constants/status';
import {
  DEFAULT_USER_NAME,
  ensureSignedIn,
  fetchUserIconUrl,
  fetchUserIsAnonymous,
  fetchUserName,
  fetchUserScheduleNote,
  fetchUserStatus,
  fetchUserStatusMessage,
  updateUserIcon,
  updateUserIsAnonymous,
  updateUserName,
  updateUserScheduleNote,
  updateUserStatus,
  updateUserStatusMessage,
} from '../../lib/auth';
import { SettingsStackParamList } from '../../navigation/types';

type LoadState = 'loading' | 'loaded' | 'error';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ProfileTop'>;

// Issue #403：Issue #356で統合したSettingsScreenを再び分割し、こちらを
// プロフィール画面（タブのトップ）として復活させた。詳細設定（テーマ・
// 入室通知・アカウント登録・削除）はSettingsScreen（歯車アイコン経由）に戻す。
// タブのトップ画面として表示するため、戻るボタンは持たない。
// Issue #362：アイコン・名前の変更は、アバター上のボタンではなく右上の⋮メニュー
// 経由にした。ステータスはアバター右下の丸バッジ化し、タップでモーダル選択する
export default function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const profileHeaderRef = useRef<ProfileHeaderHandle>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [name, setName] = useState(DEFAULT_USER_NAME);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then(async (userId) => {
        const [fetchedName, fetchedIconUrl, fetchedStatus, fetchedScheduleNote, fetchedStatusMessage, fetchedIsAnonymous] =
          await Promise.all([
            fetchUserName(userId),
            fetchUserIconUrl(userId),
            fetchUserStatus(userId),
            fetchUserScheduleNote(userId),
            fetchUserStatusMessage(userId),
            fetchUserIsAnonymous(userId),
          ]);
        setName(fetchedName ?? DEFAULT_USER_NAME);
        setIconUrl(fetchedIconUrl);
        setStatus(fetchedStatus);
        setScheduleNote(fetchedScheduleNote);
        setStatusMessage(fetchedStatusMessage);
        setIsAnonymous(fetchedIsAnonymous);
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

  // Issue #369：滞在予定・ひとことメッセージの保存。失敗時はProfileNotesSection
  // 側がトーストを出すため、ここでは例外をそのまま投げ返すだけでよい
  async function handleSaveScheduleNote(note: string) {
    const userId = await ensureSignedIn();
    await updateUserScheduleNote(userId, note || null);
    setScheduleNote(note || null);
  }

  async function handleSaveStatusMessage(message: string) {
    const userId = await ensureSignedIn();
    await updateUserStatusMessage(userId, message || null);
    setStatusMessage(message || null);
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

  return (
    <Screen style={styles.container} onMenu={() => setMenuVisible(true)}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>プロフィール</Text>
        <View style={styles.headerIcons}>
          <IconButton
            name="notifications-outline"
            variant="secondary"
            accessibilityLabel="通知ボックス"
            onPress={() => navigation.navigate('NotificationBox')}
          />
          <IconButton
            name="settings-outline"
            variant="secondary"
            accessibilityLabel="設定"
            onPress={() => navigation.navigate('Settings')}
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
          <StatusBadge
            status={status}
            onPress={() => setStatusModalVisible(true)}
            disabled={updatingStatus}
          />
        }
      />

      {/* Issue #369：プロフィール画面（自分）・友達詳細画面の共通レイアウト。
          自分の画面では編集可能にする */}
      <ProfileNotesSection
        scheduleNote={scheduleNote}
        statusMessage={statusMessage}
        editable
        onSaveScheduleNote={handleSaveScheduleNote}
        onSaveStatusMessage={handleSaveStatusMessage}
      />

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
  // Issue #359：匿名モードは使う頻度・とっさ性が高いため、他の設定項目とは
  // 別格の大きいボタンにする。ON時はcolors.sand背景+シャドウで光るような
  // 強調表現にする（developer指示・司令塔チャットで方針確認済み）
  anonymousButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  toggleSubLabel: {
    ...typography.caption,
  },
  menuButton: {
    marginBottom: spacing.sm,
  },
});
