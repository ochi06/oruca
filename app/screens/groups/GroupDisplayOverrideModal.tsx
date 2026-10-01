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
};

// グループ参加直後に、そのグループ内限定の表示名・アイコンを任意で
// 設定してもらうモーダル（Issue #150）。closed（招待承諾）・open（QR参加）
// の両方の参加フローから共通で使う
export function GroupDisplayOverrideModal({ visible, defaultName, onSkip, onSave }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [localIconUri, setLocalIconUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    <Modal visible={visible} onClose={handleSkip} title="このグループ内での表示を設定しますか？">
      <Text style={{ color: colors.textSub, marginBottom: spacing.md }}>
        設定すると、このグループ内の一覧・在席表示でのみ使われます（任意）。
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
        <Button label="スキップ" variant="secondary" onPress={handleSkip} style={styles.button} disabled={saving} />
        <Button label={saving ? '保存中…' : '保存'} onPress={handleSave} style={styles.button} disabled={saving} />
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
