import { StyleSheet } from 'react-native';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { spacing } from '../theme/spacing';

type Props = {
  message: string;
  onBack: () => void;
};

// Issue #114のスコープは画面遷移の箱を作ることで、中身は別issueで実装する。
// その間の仮表示として使う共通コンポーネント（例：グループ作成 #116）
export function PlaceholderScreen({ message, onBack }: Props) {
  return (
    <Screen style={styles.container}>
      <EmptyState icon="construct-outline" message={message} />
      <Button label="戻る" variant="secondary" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    justifyContent: 'center',
  },
});
