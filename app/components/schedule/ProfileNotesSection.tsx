import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../Button';
import { useToast } from '../Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const NOTE_MAX_LENGTH = 100;

type Props = {
  scheduleNote: string | null;
  statusMessage: string | null;
  // trueの間、SettingsScreen（自分）向けの入力欄+保存ボタンを表示する。
  // falseまたは省略時はFriendDetailScreen（友達）向けの閲覧専用表示になる
  editable?: boolean;
  onSaveScheduleNote?: (note: string) => Promise<void>;
  onSaveStatusMessage?: (message: string) => Promise<void>;
};

// Issue #369：プロフィール画面（自分、編集可）・友達詳細画面（閲覧のみ）で
// 共通利用する、滞在予定・ひとことメッセージの表示/編集セクション。
// Issue #367でエリア単位の概念を廃止し、ユーザー1人につき1つの自由記述欄
// （USERS.schedule_note・status_message）に統合したことに伴う画面側の対応。
// 旧FriendScheduleNoteを置き換える
export function ProfileNotesSection({
  scheduleNote,
  statusMessage,
  editable = false,
  onSaveScheduleNote,
  onSaveStatusMessage,
}: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [scheduleInput, setScheduleInput] = useState(scheduleNote ?? '');
  const [statusInput, setStatusInput] = useState(statusMessage ?? '');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  // 閲覧のみの場合、未設定の項目はそもそもセクション自体を出さない
  // （友達一覧・詳細に空のラベルだけ並ぶのを避ける）
  const showSchedule = editable || (scheduleNote?.trim().length ?? 0) > 0;
  const showStatusMessage = editable || (statusMessage?.trim().length ?? 0) > 0;

  if (!showSchedule && !showStatusMessage) {
    return null;
  }

  async function handleSaveSchedule() {
    if (!onSaveScheduleNote) return;
    setSavingSchedule(true);
    try {
      await onSaveScheduleNote(scheduleInput.trim());
      showToast('滞在予定を更新しました');
    } catch {
      showToast('滞在予定の更新に失敗しました');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleSaveStatusMessage() {
    if (!onSaveStatusMessage) return;
    setSavingStatus(true);
    try {
      await onSaveStatusMessage(statusInput.trim());
      showToast('ひとことメッセージを更新しました');
    } catch {
      showToast('ひとことメッセージの更新に失敗しました');
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <View>
      {showSchedule && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>滞在予定</Text>
          {editable ? (
            <>
              <TextInput
                style={[styles.input, { borderColor: colors.textSub, color: colors.text }]}
                placeholder="例：月　学校／すい　研究室"
                placeholderTextColor={colors.textSub}
                value={scheduleInput}
                onChangeText={setScheduleInput}
                maxLength={NOTE_MAX_LENGTH}
              />
              <Button
                label={savingSchedule ? '保存中…' : '保存'}
                onPress={handleSaveSchedule}
                disabled={savingSchedule}
                style={styles.saveButton}
              />
            </>
          ) : (
            <Text style={{ color: colors.text }}>{scheduleNote}</Text>
          )}
        </View>
      )}

      {showStatusMessage && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>ひとことメッセージ</Text>
          {editable ? (
            <>
              <TextInput
                style={[styles.input, { borderColor: colors.textSub, color: colors.text }]}
                placeholder="例：今日は学校にいる！"
                placeholderTextColor={colors.textSub}
                value={statusInput}
                onChangeText={setStatusInput}
                maxLength={NOTE_MAX_LENGTH}
              />
              <Button
                label={savingStatus ? '保存中…' : '保存'}
                onPress={handleSaveStatusMessage}
                disabled={savingStatus}
                style={styles.saveButton}
              />
            </>
          ) : (
            <Text style={{ color: colors.text }}>{statusMessage}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.heading,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  saveButton: {
    alignSelf: 'flex-start',
  },
});
