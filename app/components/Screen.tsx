import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { IconButton } from './IconButton';
import { spacing } from '../theme/spacing';

// 左上の戻る矢印（IconButton、size=20+内部padding spacing.sm*2）が、
// 画面側のタイトル等の先頭コンテンツと重ならないよう確保する高さ
// （矢印の上オフセットspacing.sm＋ボタン自体の高さ＋下の余白spacing.sm）
// disableSafeAreaPadding時に画面側で戻るボタンとの重なりを自前で避ける
// 必要がある場合（Issue #275のMapScreen等）のためexportする
export const BACK_BUTTON_RESERVED_HEIGHT = spacing.sm + 36 + spacing.sm;

type Props = ViewProps & {
  // 入力欄がある画面（OTP入力・検索など）ではtrueにして、キーボードが
  // 入力欄を隠さないようにする（docs/design-system.md参照）
  avoidKeyboard?: boolean;
  // タブのルート画面を除く、スタック内にpushされた画面で指定する。
  // 渡すと左上に小さい矢印の戻るボタンをオーバーレイ表示する（Issue #239、
  // 画面下部の大きい「戻る」ボタンを置き換える形に統一）
  onBack?: () => void;
  // trueの間、セーフエリアinsetsを外側Viewのpaddingとして適用しない（Issue #275）。
  // 地図をステータスバー下まで画面いっぱいに表示したいMapScreenなど、画面側で
  // 独自にinsetsを扱いたい場合に使う（戻るボタンの位置自体は変わらず、
  // 常にinsets分オフセットする）
  disableSafeAreaPadding?: boolean;
  // 渡すと右上に「…」メニューボタンをオーバーレイ表示する（Issue #276、
  // onBackと対称のパターン）。ブロック・削除など、画面単位の操作をまとめる
  // メニューを開く用途を想定
  onMenu?: () => void;
};

// 各画面のルートで使う共通レイアウト。ノッチ・ホームバー等を避けるセーフエリア
// 対応を画面ごとに個別実装せず、ここに集約する（docs/design-system.md参照）。
export function Screen({
  children,
  style,
  avoidKeyboard = false,
  onBack,
  disableSafeAreaPadding = false,
  onMenu,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // セーフエリアのinsets分のpaddingと、呼び出し側が渡すstyleのpaddingを
  // 同じViewに同居させると、個別辺指定（paddingTop等）と一括指定（padding）が
  // 競合した際に前者が常に優先されてしまい、呼び出し側のpaddingが実質無効化
  // されるため（Issue #240、RN/Yogaの仕様）、外側（セーフエリアのpaddingのみ）・
  // 内側（呼び出し側のstyleのみ）の2重Viewに分離する
  const content = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          paddingTop: disableSafeAreaPadding ? 0 : insets.top,
          paddingBottom: disableSafeAreaPadding ? 0 : insets.bottom,
          paddingLeft: disableSafeAreaPadding ? 0 : insets.left,
          paddingRight: disableSafeAreaPadding ? 0 : insets.right,
        },
      ]}
    >
      <View style={[styles.base, style as object]} {...rest}>
        {onBack || onMenu ? <View style={{ height: BACK_BUTTON_RESERVED_HEIGHT }} /> : null}
        {children}
      </View>
      {onBack ? (
        <IconButton
          name="arrow-back-outline"
          variant="ghost"
          size={20}
          accessibilityLabel="戻る"
          onPress={onBack}
          style={[styles.backButton, { top: insets.top + spacing.sm, left: insets.left + spacing.sm }]}
        />
      ) : null}
      {onMenu ? (
        <IconButton
          name="ellipsis-vertical"
          variant="ghost"
          size={20}
          accessibilityLabel="メニュー"
          onPress={onMenu}
          style={[styles.menuButton, { top: insets.top + spacing.sm, right: insets.right + spacing.sm }]}
        />
      ) : null}
    </View>
  );

  if (!avoidKeyboard) {
    return content;
  }

  return (
    <KeyboardAvoidingView
      style={styles.base}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    zIndex: 1,
  },
  menuButton: {
    position: 'absolute',
    zIndex: 1,
  },
});
