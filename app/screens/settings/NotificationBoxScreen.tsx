import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlaceholderScreen } from '../../components/PlaceholderScreen';
import { SettingsStackParamList } from '../../navigation/types';

// 中身は未実装（グループ招待の承諾など、Issue #117）。
// Issue #114のスコープはナビゲーションの箱のみ
type Props = NativeStackScreenProps<SettingsStackParamList, 'NotificationBox'>;

export default function NotificationBoxScreen({ navigation }: Props) {
  return (
    <PlaceholderScreen message="通知ボックスは準備中です" onBack={() => navigation.goBack()} />
  );
}
