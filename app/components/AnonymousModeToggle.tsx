import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { useAnonymousModeStore } from '../store/useAnonymousModeStore';

// 一時的な匿名モードのワンタップ切替（US-013）。ON中は、承認済みの友達にも
// 名前・在席が非表示になる（store/usePresenceStore.tsのresolveDisplayName・
// buildInitialStateで分岐）。設定タブ（Issue #114でreact-navigation本導入後に
// 配置予定）から埋め込んで使う想定の単体コンポーネント。ナビゲーション構成が
// 固まるまでは、まだどの画面からも呼び出されていない
export function AnonymousModeToggle() {
  const { colors } = useTheme();
  const isAnonymous = useAnonymousModeStore((state) => state.isAnonymous);
  const toggle = useAnonymousModeStore((state) => state.toggle);

  return (
    <View style={styles.row}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]}>匿名モード</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          ONの間、友達にも名前・在席が表示されません
        </Text>
      </View>
      <Switch
        value={isAnonymous}
        onValueChange={toggle}
        trackColor={{ true: colors.blue, false: colors.lightblue }}
        accessibilityLabel="匿名モード"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    ...typography.body,
  },
  subtitle: {
    ...typography.caption,
  },
});
