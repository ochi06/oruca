import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { useToast } from './Toast';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

// エリア名（AREA_NAME_MAX_LENGTH）と同程度の上限を設ける。DB側に長さ制約は
// 無いが、一覧・アイコン横での表示崩れを防ぐための画面側のガード
const DISPLAY_NAME_MAX_LENGTH = 30;

type Props = {
  name: string;
  iconUrl: string | null;
  // Issue #266：SettingsScreen（編集可能）・FriendDetailScreen（読み取り専用）の
  // アイコン＋名前表示部分（タップでの拡大表示モーダル含む）を共通化した。
  // editableがtrueの間のみ、アイコン変更・名前変更の編集導線を表示する
  editable?: boolean;
  onEditIcon?: () => void;
  iconUploading?: boolean;
  // 保存に失敗した場合はrejectする。resolveすると編集モードを閉じる
  // （成功/失敗のトースト文言は画面ごとに異なりうるため呼び出し側の責務とする）
  onSaveName?: (trimmedName: string) => Promise<void>;
  // Issue #274：FriendDetailScreenの会いたい人ハート・ステータスアイコンを
  // アバターの右下/右上に重ねて表示するための汎用スロット。editable画面
  // （SettingsScreen）はアイコン編集ボタンが右下を使うため、bottomRightBadge
  // とeditableは同時に渡さない想定
  topRightBadge?: ReactNode;
  bottomRightBadge?: ReactNode;
};

export function ProfileHeader({
  name,
  iconUrl,
  editable = false,
  onEditIcon,
  iconUploading = false,
  onSaveName,
  topRightBadge,
  bottomRightBadge,
}: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [avatarZoomVisible, setAvatarZoomVisible] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  function handleStartEditName() {
    setNameInput(name);
    setEditingName(true);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      showToast('名前を入力してください');
      return;
    }
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      showToast(`名前は${DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください`);
      return;
    }
    if (!onSaveName) return;

    setSavingName(true);
    try {
      await onSaveName(trimmed);
      setEditingName(false);
    } catch {
      // 編集モードは閉じない。エラートースト表示は呼び出し側の責務
    } finally {
      setSavingName(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrapper}>
        <Pressable onPress={() => setAvatarZoomVisible(true)} accessibilityLabel="アイコンを拡大表示">
          <Avatar iconUrl={iconUrl} name={name} size={96} />
        </Pressable>
        {editable && onEditIcon ? (
          <IconButton
            name="pencil-outline"
            variant="secondary"
            size={16}
            style={styles.avatarEditButton}
            accessibilityLabel="アイコンを変更する"
            onPress={onEditIcon}
            disabled={iconUploading}
          />
        ) : bottomRightBadge ? (
          <View style={styles.avatarEditButton}>{bottomRightBadge}</View>
        ) : null}
        {topRightBadge ? <View style={styles.avatarTopBadge}>{topRightBadge}</View> : null}
      </View>

      {editable && editingName ? (
        <View style={styles.nameEditRow}>
          <Input
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            editable={!savingName}
            autoFocus
          />
          <IconButton
            name="close-outline"
            variant="secondary"
            size={20}
            accessibilityLabel="名前の変更をキャンセル"
            onPress={() => setEditingName(false)}
            disabled={savingName}
          />
          <Button
            label={savingName ? '保存中…' : '保存'}
            onPress={handleSaveName}
            disabled={savingName}
          />
        </View>
      ) : (
        <View style={styles.nameRow}>
          {editable ? (
            <IconButton
              name="pencil-outline"
              variant="secondary"
              size={16}
              accessibilityLabel="名前を変更する"
              onPress={handleStartEditName}
            />
          ) : null}
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        </View>
      )}

      <RNModal
        visible={avatarZoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarZoomVisible(false)}
      >
        <Pressable style={styles.zoomOverlay} onPress={() => setAvatarZoomVisible(false)}>
          <View style={styles.zoomCloseButton}>
            <IconButton
              name="close-outline"
              variant="secondary"
              accessibilityLabel="閉じる"
              onPress={() => setAvatarZoomVisible(false)}
            />
          </View>
          <Avatar iconUrl={iconUrl} name={name} size={240} />
        </Pressable>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: radius.lg,
  },
  avatarTopBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  name: {
    ...typography.title,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameInput: {
    flex: 1,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
  },
});
