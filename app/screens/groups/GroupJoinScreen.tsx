import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CURRENT_USER_ID, mockUsers } from '../../mocks/presence';
import { useGroupStore } from '../../store/useGroupStore';
import { FriendsGroupsStackParamList } from '../../navigation/types';

function findUserName(userId: string): string {
  return mockUsers.find((user) => user.id === userId)?.name ?? '不明なユーザー';
}

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoin'>;

// 届いた招待（GROUP_MEMBERS.invited_byが自分以外＝誰かからの招待）の
// 一覧から参加/辞退を選ぶ画面（Issue #117）。自分から申請した場合
// （invited_by === null、Issue #119「グループ参加申請」）はここには出さない
//
// [Issue #144 既知の未解決事項] 承諾（pending→approved）は、開発者承認済みのRLS方針
// （GROUP_MEMBERS UPDATE: ownerのみ）では招待された本人自身が行えない。
// 「参加する」ボタンは一旦無効化し、承認は管理者側（GroupDetailScreenのapproveMember、
// owner操作でRLS上も許可される）待ちとして案内する。辞退（自分の行のDELETE）はRLS上
// 問題なく行えるため接続済み。本来の「招待は即座に自分で参加できる」体験に戻すには、
// RLSに自分の招待(invited_by is not null)をpending→approvedにできる例外を追加するか、
// 招待もowner承認必須のフローに仕様変更するか、開発者の判断が必要（要相談）
export default function GroupJoinScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const groups = useGroupStore((state) => state.groups);
  const invitations = useGroupStore(
    useShallow((state) =>
      state.members.filter(
        (m) => m.user_id === CURRENT_USER_ID && m.status === 'pending' && m.invited_by !== null
      )
    )
  );
  const declineInvitation = useGroupStore((state) => state.declineInvitation);
  const initialize = useGroupStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  function handleAccept() {
    showToast('現在この画面からの承諾には対応していません。グループ管理者の承認をお待ちください');
  }

  async function handleDecline(memberId: string) {
    const result = await declineInvitation(memberId);
    if (result.status === 'success') {
      showToast('招待を辞退しました');
    }
  }

  return (
    <Screen style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>グループ参加</Text>

      {invitations.length === 0 ? (
        <EmptyState icon="mail-open-outline" message="届いている招待はありません" />
      ) : (
        invitations.map((invitation) => {
          const group = groups.find((g) => g.id === invitation.group_id);
          return (
            <ListItem
              key={invitation.id}
              title={group?.name ?? '不明なグループ'}
              subtitle={`${findUserName(invitation.invited_by!)}からの招待`}
              trailing={
                <View style={styles.actions}>
                  <Button label="参加する" onPress={handleAccept} style={styles.actionButton} />
                  <Button
                    label="辞退する"
                    variant="secondary"
                    onPress={() => handleDecline(invitation.id)}
                    style={styles.actionButton}
                  />
                </View>
              }
            />
          );
        })
      )}

      <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
  },
  backButton: {
    marginTop: spacing.md,
  },
});
