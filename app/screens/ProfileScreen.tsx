import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Screen } from '../components/Screen';
import { useToast } from '../components/Toast';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { USER_STATUS_OPTIONS, UserStatus } from '../constants/status';
import {
  DEFAULT_USER_NAME,
  ensureSignedIn,
  fetchUserIconUrl,
  fetchUserName,
  fetchUserStatus,
  updateUserIcon,
  updateUserStatus,
} from '../lib/auth';

type LoadState = 'loading' | 'loaded' | 'error';

export default function ProfileScreen() {
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
      <Text style={[styles.title, { color: colors.text }]}>プロフィール</Text>
      <View style={styles.avatarSection}>
        <Avatar iconUrl={iconUrl} name={name} size={96} />
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        <Button
          label={uploading ? 'アップロード中…' : 'アイコンを変更する'}
          onPress={handleChangeIcon}
          disabled={uploading}
        />
      </View>

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
  title: {
    ...typography.heading,
    marginBottom: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    ...typography.body,
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
