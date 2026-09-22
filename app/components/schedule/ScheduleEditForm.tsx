import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../Button';
import { useToast } from '../Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useScheduleStore } from '../../store/useScheduleStore';

const SCHEDULE_NOTE_MAX_LENGTH = 100;

type Props = {
  areaId: string;
};

// 自分の基本滞在予定・当日上書き予定の入力フォーム（US-011）。
// 設定タブ（Issue #114でreact-navigation本導入後に配置）から埋め込んで使う想定の
// 単体コンポーネント。ナビゲーション構成が固まるまでは、まだどの画面からも
// 呼び出されていない
export function ScheduleEditForm({ areaId }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();

  const myNote = useScheduleStore((state) => state.myNote(areaId));
  const myOverrideNote = useScheduleStore((state) => state.myOverrideNote(areaId));
  const setMyNote = useScheduleStore((state) => state.setMyNote);
  const setMyOverrideNote = useScheduleStore((state) => state.setMyOverrideNote);

  const [noteInput, setNoteInput] = useState(myNote ?? '');
  const [overrideInput, setOverrideInput] = useState(myOverrideNote ?? '');

  function handleSaveNote() {
    setMyNote(areaId, noteInput.trim());
    showToast('基本の滞在予定を保存しました');
  }

  function handleSaveOverride() {
    setMyOverrideNote(areaId, overrideInput.trim());
    showToast('今日の予定を保存しました');
  }

  return (
    <View>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>基本の滞在予定</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.textSub, color: colors.text }]}
          placeholder="例：平日9-19時、土日は不定期"
          placeholderTextColor={colors.textSub}
          value={noteInput}
          onChangeText={setNoteInput}
          maxLength={SCHEDULE_NOTE_MAX_LENGTH}
        />
        <Button label="保存" onPress={handleSaveNote} style={styles.saveButton} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>今日だけの予定変更</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.textSub, color: colors.text }]}
          placeholder="例：今日は17時退勤"
          placeholderTextColor={colors.textSub}
          value={overrideInput}
          onChangeText={setOverrideInput}
          maxLength={SCHEDULE_NOTE_MAX_LENGTH}
        />
        <Button label="保存" onPress={handleSaveOverride} style={styles.saveButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
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
