import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlaceholderScreen } from '../../components/PlaceholderScreen';
import { FriendsGroupsStackParamList } from '../../navigation/types';

// 中身は未実装（滞在予定の閲覧＝US-011、ブロック設定＝Issue #121）。
// Issue #114のスコープはナビゲーションの箱のみ
type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'FriendDetail'>;

export default function FriendDetailScreen({ navigation }: Props) {
  return (
    <PlaceholderScreen message="友達詳細は準備中です" onBack={() => navigation.goBack()} />
  );
}
