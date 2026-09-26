import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { GROUP_NAME_MAX_LENGTH } from '../../constants/group';
import { CURRENT_USER_ID } from '../../mocks/presence';
import { useGroupStore } from '../../store/useGroupStore';
import { FriendsGroupsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupCreate'>;

// グループ作成画面（Issue #116）。バックエンド未接続のため、useGroupStoreの
// モック状態にそのまま追加する（他の操作＝承認・退会等と同じ方針）
export default function GroupCreateScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const createGroup = useGroupStore((state) => state.createGroup);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('グループ名を入力してください');
      return;
    }
    if (trimmedName.length > GROUP_NAME_MAX_LENGTH) {
      showToast(`グループ名は${GROUP_NAME_MAX_LENGTH}文字以内で入力してください`);
      return;
    }

    setCreating(true);
    const newGroup = createGroup(trimmedName, CURRENT_USER_ID);
    showToast(`「${newGroup.name}」を作成しました`);
    // 一覧に戻らず、作成したグループの詳細画面へそのまま遷移する
    navigation.replace('GroupDetail', { groupId: newGroup.id });
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>グループ作成</Text>
      <Input
        value={name}
        onChangeText={setName}
        placeholder="グループ名（例：バイト先）"
        maxLength={GROUP_NAME_MAX_LENGTH}
        editable={!creating}
        autoFocus
      />
      <Button
        label={creating ? '作成中…' : '作成する'}
        onPress={handleCreate}
        disabled={creating}
        style={styles.createButton}
      />
      <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} disabled={creating} />
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
  createButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
