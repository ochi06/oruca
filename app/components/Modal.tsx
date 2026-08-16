import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  ModalProps,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = ModalProps & {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

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
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {title ? (
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          ) : null}
          {children}
        </View>
      </View>
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
  title: {
    fontSize: typography.heading.fontSize,
    fontFamily: typography.heading.fontFamily,
    marginBottom: spacing.md,
  },
});
