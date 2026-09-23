# app/ セットアップ・実行方法

oruca本体（Expo + TypeScript）のセットアップと、エミュレーター・実機での
起動方法をまとめる。設計・方針は必ずリポジトリ直下の `docs/` を参照すること。

## 前提

- Node.js（`.nvmrc`等は未整備。動作確認済みバージョンは各自の`node -v`を確認）
- Android: Android Studio（SDK・エミュレーター込み）、JDK 17
- iOS: Xcode（Macのみ）

**重要**：oruca は `react-native-maps`・`expo-camera`・`expo-image-picker`・
`expo-file-system`などネイティブモジュールを多数使っているため、
**Expo Go（App Store/Google Playの汎用アプリ）では動作しない**。
必ず`npx expo run:android` / `npx expo run:ios`で作成した開発用ビルド
（dev client）を使うこと。

**重要（2026-09-23）**：Androidエミュレーター（実機）は複数チャットで
1台を共有している。**エミュレーター・実機への操作（`npx expo run:android`、
`adb`コマンド全般、アプリの起動/停止/再インストール等）はtestチャットのみが
行う**こと。他のチャットは自分で実行せず、確認したい内容をtestチャットに
具体的に依頼し、結果（ログ・スクリーンショット等）を報告してもらう形にする
（ポート番号を分けても、インストール先のデバイスは1台しかないため、
複数チャットが同時に触るとアプリの再インストール・強制終了が競合する）。

## セットアップ

```bash
cd app
npm install
```

`.env.development`（gitignore対象）に以下を設定する。値はプロジェクト管理者に確認：

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
GOOGLE_MAPS_API_KEY=...
```

worktreeで作業する場合は、mainの`app/.env.development`をシンボリックリンクする運用。

## Androidエミュレーターで実行する

1. Android Studioでエミュレーター（AVD）を作成済みであること
2. エミュレーターを起動（DNS解決が不安定な場合の対処込み）：
   ```bash
   emulator -avd <AVDの名前> -dns-server 8.8.8.8,8.8.4.4
   ```
3. 起動完了を待つ：
   ```bash
   adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 2; done; echo booted'
   ```
4. ビルド・インストール・起動：
   ```bash
   npx expo run:android --port 8086
   ```
   （2回目以降、JSのみの変更は`npx expo start --port 8086`を起動したままリロードでも反映される。
   ネイティブ依存が変わった場合（package.json変更・config plugin変更など）は
   `npx expo run:android`でのフルビルドが必要）

### 既知のトラブルと対処

- **`A restricted method in java.lang.System has been called`等でネイティブビルド失敗**：
  JDK 25など新しすぎるJDKが`java`として使われている。JDK 17を使うよう
  `android/gradle.properties`に以下を追記する（`npx expo prebuild`で`android/`が
  再生成されると消えるため、その都度追記し直す必要がある）：
  ```
  org.gradle.java.home=/path/to/temurin-17
  ```
  JDK 17が入っていない場合は、既存のJDK（例：JDK 25）とは別に共存インストールできる
  （システムのデフォルトjavaを変更する必要はない）：
  ```bash
  brew install --cask temurin@17
  ```
  インストール後のパスは`/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home`
  （`/usr/libexec/java_home -V`で確認できる）
- **`java.net.UnknownHostException`でSupabase接続に失敗**：エミュレーターのDNS問題。
  上記の`-dns-server 8.8.8.8,8.8.4.4`付きで起動し直す
- **`[CXX5304] This version only understands SDK XML versions up to 3 but an SDK XML file of version 4 was encountered`でネイティブビルド失敗**：
  `$ANDROID_HOME/cmdline-tools/latest`のバージョンが古い。
  `sdkmanager --list`で新しいバージョン（例：`cmdline-tools;23.0`）を確認し、
  `sdkmanager --install "cmdline-tools;23.0"`でインストールしてから
  `cmdline-tools/latest`を差し替える
- **`EXPO_PUBLIC_...が設定されていません`エラーで起動直後にクラッシュ**：
  `.env.development`確定前から起動しっぱなしのMetroプロセスが、環境変数を
  読み込めないまま残っている可能性が高い。`expo start`の再起動だけでは
  直らないことがあるため、`adb uninstall <package>` → `npx expo run:android`で
  クリーン再インストールする
- **メールのマジックリンクが届かない/送信エラーになる**：Supabaseの内蔵メーラーは
  1時間あたり数件までしか送れない。Authentication > Emails > SMTP Settingsで
  カスタムSMTP（例：Resend）を設定すると解消する

## Android実機で実行する

1. 実機をUSB接続し、開発者モード・USBデバッグを有効化
2. `adb devices`で認識されていることを確認
3. Androidエミュレーターと同じ手順（`npx expo run:android --port 8086`）で実行
   （複数の実装チャットが同時にテストする場合のポート割り当ては
   `docs/architecture.md`「4. 実機テスト用のExpo開発サーバーのポート割り当て」参照。
   ただし前述の通り現在はExpo Goが使えないため、各USごとにdevビルドを
   作り直す必要がある点に注意）

## iOSシミュレーターで実行する（Macのみ）

```bash
npx expo run:ios --device "iPhone 17"
```

- シミュレーター名は`xcrun simctl list devices`で確認できる
- 動作確認済みシミュレーターが無い場合はXcodeから作成する

### 既知のトラブルと対処

- **`No podspec found for react-native-google-maps`でPodfile生成が失敗**：
  `react-native-maps`のバージョンとexpo prebuildが生成するPodfileの不整合
  （Issue #76で対応済み。`app/plugins/withFixMapsPodname.js`で自動修正される）

## iOS実機で実行する

開発者はiOS実機を保有していないため、この項目は未検証。TestFlightでの配布を
準備中（Apple Developer Program登録が前提）。実機検証が必要な場合は、
第三者のiOS実機を借りて`npx expo run:ios --device`でUSBケーブル経由の
インストールを試すか、TestFlight配布の準備を待つこと。

## 複数チャット・複数worktreeでの同時実行について

エミュレーター・シミュレーターは共有リソースであり、複数のチャットから
同時に操作すると干渉する（Metroサーバーのポート衝突、adb reverseの奪い合い等）。
動作確認は`test`チャットに集約し、各実装チャット（`code*`）では
エミュレーター・シミュレーターを起動しない運用とする。