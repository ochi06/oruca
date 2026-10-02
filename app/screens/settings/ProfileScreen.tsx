import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { ProfileHeader } from '../../components/ProfileHeader';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { USER_STATUS_OPTIONS, UserStatus } from '../../constants/status';
import {
  DEFAULT_USER_NAME,
  ensureSignedIn,
  fetchUserIconUrl,
  fetchUserName,
  fetchUserStatus,
  updateUserIcon,
  updateUserName,
  updateUserStatus,
} from '../../lib/auth';
import { SettingsStackParamList } from '../../navigation/types';

type LoadState = 'loading' | 'loaded' | 'error';

type Props = NativeStackScreenProps<SettingsStackParamList, 'ProfileTop'>;

// Issue #176: docs/architecture.md（2026-09-27決定）通り、プロフィール編集
// （アイコン・表示名・ステータス）をタブのトップ画面として独立させる。
// 詳細設定（テーマ・入室通知等）は歯車アイコンからSettingsScreenへ遷移する
export default function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [state, setState] = useState<LoadState>('loading');
  const [name, setName] = useState(DEFAULT_USER_NAME);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then(async (userId) => {
        const [fetchedName, fetchedIconUrl, fetchedStatus] = await Promise.all([
          fetchUserName(userId),
          fetchUserIconUrl(userId),
          fetchUserStatus(userId),
        ]);
        setName(fetchedName ?? DEFAULT_USER_NAME);
        setIconUrl(fetchedIconUrl);
        setStatus(fetchedStatus);
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
    setUploading(true);
    try {
      const userId = await ensureSignedIn();
      const newIconUrl = await updateUserIcon(userId, asset.uri);
      setIconUrl(newIconUrl);
      showToast('アイコンを更新しました');
    } catch (error) {
      console.error('updateUserIcon failed:', error);
      showToast('アイコンの更新に失敗しました');
    } finally {
      setUploading(false);
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
    <Screen style={styles.container}>
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
        name={name}
        iconUrl={iconUrl}
        editable
        onEditIcon={handleChangeIcon}
        iconUploading={uploading}
        onSaveName={handleSaveName}
      />

      <View style={styles.statusSection}>
        <Text style={[styles.sectionLabel, { color: colors.textSub }]}>ステータス</Text>
        <View style={styles.statusOptions}>
          {USER_STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant={status === option.value ? 'primary' : 'secondary'}
              onPress={() => handleSelectStatus(option.value)}
              disabled={updatingStatus}
              style={styles.statusChip}
            />
          ))}
        </View>
      </View>
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
  statusSection: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
  },
});
