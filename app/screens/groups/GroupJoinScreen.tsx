import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlaceholderScreen } from '../../components/PlaceholderScreen';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身は未実装（届いた招待の一覧から承諾/辞退、Issue #117）。
// 設定タブの通知ボックスからも同じ画面に遷移する想定。
// Issue #114のスコープはナビゲーションの箱のみ
type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupJoin'>;

export default function GroupJoinScreen({ navigation }: Props) {
  return (
    <PlaceholderScreen message="グループ参加（招待の承諾）は準備中です" onBack={() => navigation.goBack()} />
  );
}
