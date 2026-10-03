import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { userStatusLabel } from '../../constants/status';
import { AreaPresentUser } from '../../utils/presenceMarkers';

const PREVIEW_COUNT = 3;

type Props = {
  areaName: string;
  users: AreaPresentUser[];
  // Issue #278：アイコンタップで友達詳細画面へ遷移できるのは、FRIENDSHIPSの
  // 友達のみ（displayNameが見える＝可視というだけでは、グループ同席など
  // 友達以外の理由で見えている場合も含むため区別する）
  friendIds: Set<string>;
  onClose: () => void;
  onSeeAll: () => void;
  onPressUser: (userId: string) => void;
};

// エリアタップ時のポップアップ（Issue #120）。在席者を最大3件プレビューし、
// 4件以上いる場合のみ「もっと見る」でフルリスト（PresenceListScreen）に遷移する
export function AreaPresencePopup({ areaName, users, friendIds, onClose, onSeeAll, onPressUser }: Props) {
  const { colors } = useTheme();
  const preview = users.slice(0, PREVIEW_COUNT);

  function handlePressUser(userId: string) {
    onClose();
    onPressUser(userId);
  }

  return (
    <Modal
      visible
      onClose={onClose}
      // Issue #277：エリア名の右に在席人数を小さく表示する
      title={
        <View style={styles.titleRow}>
          <Text style={[styles.titleName, { color: colors.text }]} numberOfLines={1}>
            {areaName}
          </Text>
          <Text style={[typography.caption, { color: colors.textSub }]}>（{users.length}人）</Text>
        </View>
      }
    >
      <View style={styles.avatarRow}>
        {preview.map((user) => {
          // Issue #278：在席者一覧の名前は非表示にし、アイコン＋ステータスのみ表示する。
          // 友達でない相手はFriendDetailScreenへの遷移先が無いためタップ無効のままにする
          // （Issue #394：縦並びのListItemから、アイコンを横に並べる表示に変更）
          const isFriend = friendIds.has(user.userId);
          const statusLabel = userStatusLabel(user.status);
          const content = (
            <>
              <Avatar name={user.displayName ?? '?'} iconUrl={user.iconUrl} />
              {statusLabel ? (
                <Text
                  style={[styles.statusLabel, { color: colors.textSub }]}
                  numberOfLines={1}
                >
                  {statusLabel}
                </Text>
              ) : null}
            </>
          );
          return isFriend ? (
            <Pressable
              key={user.userId}
              onPress={() => handlePressUser(user.userId)}
              accessibilityLabel="友達詳細を見る"
              style={styles.avatarItem}
            >
              {content}
            </Pressable>
          ) : (
            <View key={user.userId} style={styles.avatarItem}>
              {content}
            </View>
          );
        })}
      </View>
      {users.length > PREVIEW_COUNT && (
        <View style={styles.buttonRow}>
          <Button label="もっと見る" onPress={onSeeAll} style={styles.button} />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  titleName: {
    flexShrink: 1,
    fontSize: typography.heading.fontSize,
    fontFamily: typography.heading.fontFamily,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginVertical: spacing.sm,
  },
  avatarItem: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 64,
  },
  statusLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
  },
});
