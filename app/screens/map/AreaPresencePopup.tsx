import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ListItem } from '../../components/ListItem';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { formatPresenceCount } from '../../utils/format';
import { userStatusLabel } from '../../constants/status';
import { AreaPresentUser } from '../../store/usePresenceStore';

const PREVIEW_COUNT = 3;

type Props = {
  areaName: string;
  users: AreaPresentUser[];
  onClose: () => void;
  onSeeAll: () => void;
};

// エリアタップ時のポップアップ（Issue #120）。在席者を最大3件プレビューし、
// 4件以上いる場合のみ「もっと見る」でフルリスト（PresenceListScreen）に遷移する
export function AreaPresencePopup({ areaName, users, onClose, onSeeAll }: Props) {
  const { colors } = useTheme();
  const preview = users.slice(0, PREVIEW_COUNT);

  return (
    <Modal visible onClose={onClose} title={areaName}>
      <Text style={[typography.caption, { color: colors.textSub, marginBottom: spacing.sm }]}>
        {formatPresenceCount(users.length)}
      </Text>
      {preview.map((user) => (
        <ListItem
          key={user.userId}
          title={user.displayName ?? '非公開'}
          subtitle={userStatusLabel(user.status) ?? undefined}
          leading={<Avatar name={user.displayName ?? '?'} iconUrl={user.iconUrl} />}
        />
      ))}
      <View style={styles.buttonRow}>
        {users.length > PREVIEW_COUNT && (
          <Button label="もっと見る" onPress={onSeeAll} style={styles.button} />
        )}
        <Button label="閉じる" variant="secondary" onPress={onClose} style={styles.button} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
  },
});
