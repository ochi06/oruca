import * as Haptics from 'expo-haptics';

// Button/IconButton共通のタップ操作フィードバック（Issue #38）。
// Web版（expo-haptics SDK57のnavigator.vibrate()フォールバック）も含め
// 全プラットフォームでそのまま呼べるが、非対応環境でHapticsが例外を
// 投げてもボタン操作自体は継続させたいため、ここで握りつぶす
export async function triggerTapHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // 触覚フィードバックに失敗しても画面操作自体には影響させない
  }
}
