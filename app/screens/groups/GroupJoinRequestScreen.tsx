import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlaceholderScreen } from '../../components/PlaceholderScreen';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身は未実装（公開グループを検索して申請、Issue #119）。
// Issue #114のスコープはナビゲーションの箱のみ
type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoinRequest'>;

export default function GroupJoinRequestScreen({ navigation }: Props) {
  return (
    <PlaceholderScreen message="グループ参加申請（検索）は準備中です" onBack={() => navigation.goBack()} />
  );
}
