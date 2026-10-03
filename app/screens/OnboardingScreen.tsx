import { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Slide = {
  // cover: アプリ名を表示する表紙スライド（Issue #384）。アイコンは
  // 使わず、文字だけのシンプルな構成にする（アプリアイコン画像自体は
  // Issue #37が未着手のため使えない）
  variant?: 'cover';
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    variant: 'cover',
    title: 'oruca',
    body: 'エリア限定・関係限定の在席可視化アプリ',
  },
  {
    icon: 'location-outline',
    title: 'エリアに入った時だけ',
    body: '登録したエリア（職場・学校など）に入っている間だけ位置情報を検知します。それ以外の場所・時間のデータは保存も送信もされません。',
  },
  {
    icon: 'people-outline',
    title: '関係限定で安心',
    body: '在席状況が見えるのは、友達として承認した相手や、同じグループのメンバーだけです。知らない人に居場所が公開されることはありません。',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'さっそく始めましょう',
    body: 'エリアを登録し、友達を追加したりグループに参加すると、マップでお互いの在席状況が確認できるようになります。',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  onDone: () => void;
};

// 初回起動時のオンボーディング画面（Issue #246）。docs/oruca_PRD.md「画面構成」の
// 「説明系画面：初回起動時や使い方を説明するオンボーディング画面」に対応する。
// ブース展示の最低要件には含まれない埋め草的優先度のタスクのため、イラスト素材
// （Issue #37/#39、未着手）には依存せず、アイコン+テキストのみで構成する
export default function OnboardingScreen({ onDone }: Props) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLastSlide = index === SLIDES.length - 1;

  // 手でスワイプした場合にドット・フッターをスクロール位置に追従させる。
  // ボタン操作時はhandleNext側でindexを直接更新するため、ここでの更新と
  // 二重になっても実質的に同じ値になるだけで問題ない
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (nextIndex !== index) setIndex(nextIndex);
  }

  function handleNext() {
    if (isLastSlide) {
      onDone();
      return;
    }
    const nextIndex = index + 1;
    // Web版ではscrollTo({animated:true})後のonMomentumScrollEndが発火しない
    // ことがあるため、スクロール位置に追従させるのではなくボタン操作側で
    // 直接indexを進める（Issue #246）
    setIndex(nextIndex);
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * nextIndex, animated: true });
  }

  return (
    <Screen style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
      >
        {SLIDES.map((slide) =>
          slide.variant === 'cover' ? (
            <View key={slide.title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              <Text style={[styles.coverTitle, { color: colors.blue }]}>{slide.title}</Text>
              <Text style={[styles.body, { color: colors.textSub }]}>{slide.body}</Text>
            </View>
          ) : (
            <View key={slide.title} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              {slide.icon && <Ionicons name={slide.icon} size={96} color={colors.blue} />}
              <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
              <Text style={[styles.body, { color: colors.textSub }]}>{slide.body}</Text>
            </View>
          )
        )}
      </ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.blue : colors.lightblue },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        {!isLastSlide && (
          <Button label="スキップ" variant="secondary" onPress={onDone} style={styles.footerButton} />
        )}
        <Button
          label={isLastSlide ? 'はじめる' : '次へ'}
          onPress={handleNext}
          style={styles.footerButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  title: {
    ...typography.title,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  coverTitle: {
    fontFamily: typography.title.fontFamily,
    fontSize: 48,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footerButton: {
    flex: 1,
  },
});
