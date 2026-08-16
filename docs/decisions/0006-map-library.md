# ADR-0006: 地図ライブラリの選定とネイティブビルドへの移行

## 決定事項

- 地図表示・ピン設置・円形エリア描画には`react-native-maps`を使う
- 半径指定のスライダーUIには`@react-native-community/slider`を使う
- 上記2つはネイティブモジュールを含むため、開発時の動作確認は
  Expo Go（`expo start`）ではなく、開発ビルド（`expo run:android` /
  `expo run:ios`）で行う

## 理由

### react-native-maps
- React Native + Expoエコシステムで最も広く使われている地図ライブラリで、
  ピン（Marker）・円（Circle）・地図タイルのカスタムスタイル
  （`customMapStyle`）など、US-018で必要な機能を標準で備えている
- 定番ライブラリを使うこと自体に学習価値がある（CLAUDE.mdの
  「ライブラリ・パッケージ利用の判断基準」に基づく判断）
- Androidでは地図タイルの表示にGoogle Maps APIキーが必須（`app.config.js`
  経由で`.env`から注入。詳細は`.note.md`参照）。iOSは標準のApple Mapsを
  使うため不要

### @react-native-community/slider
- React Native公式が推奨する定番のスライダー実装で、`min/max/value/
  onValueChange`のみの薄いラッパー。自前実装（PanResponder等）の方が
  学習価値が高いのは「タップ位置→半径」の変換ロジック（円のハンドル
  ドラッグ）側であり、スライダー自体は既製品に任せて時間を使う方が
  効率的と判断（2026-08-16、開発者と合意）

### ネイティブビルドへの移行
- 上記2つはネイティブコードを含むため、Expo Go（誰でも使える汎用アプリ）
  では動かせない（カスタムのGoogle Maps APIキー設定などはExpo Goの
  ビルドに反映されない）
- そのため`package.json`の`android`/`ios`スクリプトを`expo start
  --android/--ios`から`expo run:android`/`expo run:ios`（開発ビルドを
  ローカルでビルドしてインストール）に変更した
- `android/`・`ios/`ディレクトリは`expo prebuild`により自動生成される
  ため、`.gitignore`済み（コミットしない）

## 見送った選択肢

- スライダーの自前実装（PanResponder等）：円のハンドルドラッグと役割が
  重複するため、スライダー側は既製品に任せることにした
