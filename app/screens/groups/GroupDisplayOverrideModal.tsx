import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';

type Props = {
  visible: boolean;
  defaultName: string;
  onSkip: () => void;
  onSave: (displayName: string | null, localIconUri: string | null) => void | Promise<void>;
  // true の場合、名前入力を必須にしスキップできないようにする（Issue #151、
  // 本名のUSERS.nameを持たない匿名ログインでのオープングループ参加時）
  required?: boolean;
};

// グループ参加直後に、そのグループ内限定の表示名・アイコンを設定してもらう
// モーダル（Issue #150）。closed（招待承諾）・open（QR参加）の両方の参加フロー
// から共通で使う。通常は任意（スキップ可）だが、required=trueの場合は必須にする
export function GroupDisplayOverrideModal({ visible, defaultName, onSkip, onSave, required = false }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [localIconUri, setLocalIconUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canSave = !required || name.trim().length > 0;

  async function handlePickIcon() {
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
    setLocalIconUri(result.assets[0].uri);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(name.trim() || null, localIconUri);
    } finally {
      setSaving(false);
      setName('');
      setLocalIconUri(null);
    }
  }

  function handleSkip() {
    setName('');
    setLocalIconUri(null);
    onSkip();
  }

  return (
    <Modal
      visible={visible}
      onClose={required ? () => {} : handleSkip}
      title={required ? 'このグループ内で使う名前を設定してください' : 'このグループ内での表示を設定しますか？'}
    >
      <Text style={{ color: colors.textSub, marginBottom: spacing.md }}>
        {required
          ? 'メール登録なしで参加しているため、このグループ内の一覧・在席表示用の名前の入力が必要です。'
          : '設定すると、このグループ内の一覧・在席表示でのみ使われます（任意）。'}
      </Text>
      <View style={styles.iconRow}>
        <Avatar name={name || defaultName} iconUrl={localIconUri} size={64} />
        <Button label="アイコンを選ぶ" variant="secondary" onPress={handlePickIcon} />
      </View>
      <Input
        placeholder={defaultName}
        value={name}
        onChangeText={setName}
        style={styles.nameInput}
      />
      <View style={styles.buttonRow}>
        {required ? null : (
          <Button label="スキップ" variant="secondary" onPress={handleSkip} style={styles.button} disabled={saving} />
        )}
        <Button
          label={saving ? '保存中…' : '保存'}
          onPress={handleSave}
          style={styles.button}
          disabled={saving || !canSave}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  nameInput: {
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
  },
});
