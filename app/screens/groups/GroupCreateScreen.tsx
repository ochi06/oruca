import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlaceholderScreen } from '../../components/PlaceholderScreen';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身は未実装（Issue #116）。Issue #114のスコープはナビゲーションの箱のみ
type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupCreate'>;

export default function GroupCreateScreen({ navigation }: Props) {
  return (
    <PlaceholderScreen message="グループ作成は準備中です" onBack={() => navigation.goBack()} />
  );
}
