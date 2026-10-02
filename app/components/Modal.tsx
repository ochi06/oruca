import React from 'react';
import {
  Modal as RNModal,
  Pressable,
  View,
  Text,
  StyleSheet,
  ModalProps,
} from 'react-native';
import { IconButton } from './IconButton';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = ModalProps & {
  visible: boolean;
  onClose: () => void;
  // Issue #277：AreaPresencePopupがエリア名+在席人数の2段階フォントサイズを
  // 組むために、文字列だけでなく任意のReactNodeも渡せるようにした
  title?: React.ReactNode;
  children: React.ReactNode;
};

// モーダル外（オーバーレイ）タップでの閉じる導線と、右上の閉じるボタン
// （バツマーク、docs/design-system.md「モーダル・ポップアップの閉じるボタン」
// 規則）を、ここに一律実装することで全呼び出し元に反映する（Issue #206）
export function Modal({ visible, onClose, title, children, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...rest}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* カード部分へのタップがオーバーレイのonCloseまで伝播しないよう、
            子にもPressable（no-op）を挟んで止める */}
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.header}>
            {title ? (
              typeof title === 'string' ? (
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              ) : (
                <View style={styles.titleSpacer}>{title}</View>
              )
            ) : (
              <View style={styles.titleSpacer} />
            )}
            <IconButton
              name="close-outline"
              variant="secondary"
              size={20}
              accessibilityLabel="閉じる"
              onPress={onClose}
            />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: typography.heading.fontSize,
    fontFamily: typography.heading.fontFamily,
  },
  titleSpacer: {
    flex: 1,
  },
});
