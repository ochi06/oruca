# ストア審査ガイドライン：位置情報アプリ特有の論点（Issue #30）

コンペ提出・ストア配信に向けて、位置情報を扱うアプリ特有の審査リスクを
事前に把握するための調査メモ。oruca の設計（`docs/oruca_PRD.md`・
`docs/architecture.md`）・現在の実装状況と突き合わせ、対応が必要な項目を
洗い出す。調査日：2026-10-01。ガイドライン自体は改訂されるため、
提出直前に一次情報（下記リンク）を再確認すること。

## Apple App Store

一次情報：[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### 5.1.5 Location Services

> Use Location Services in your app only when it is directly relevant to the
> features and services provided by the app. [...] Ensure that you notify and
> obtain consent before collecting, transmitting, or using location data. If
> your app uses Location Services, be sure to explain the purpose in your app

- **ポイント**：位置情報の収集・送信・利用の前に、通知と同意取得が必須。
  purpose string（後述）だけでなく、アプリ内でも利用目的を説明する必要がある
- oruca は「エリア限定」の設計思想自体が、この条項への回答になりうる
  （エリア外では位置情報を収集しないことを明示できる）

### 5.1.1(ii) Permission（purpose stringの書き方）

> Ensure your purpose strings clearly and completely describe your use of the data.

- `NSLocationWhenInUseUsageDescription`等の文言は、「何のために」「何を」
  取得するかを具体的に書く必要がある（「位置情報を使います」だけでは不十分）
- レビュワーはこの文言を実際に読んで判断するため、機能と矛盾しない説明に
  すること

### 2.5.4 Multitasking & Background Modes

> Multitasking apps may only use background services for their intended
> purposes: VoIP, audio playback, location, task completion, local
> notifications, etc.

- バックグラウンドでの位置情報取得（`UIBackgroundModes: ["location"]`）は、
  実際にその機能（ジオフェンス検知）のために使われている必要がある。
  "Always"権限だけ要求してバックグラウンドで実際には使っていない、
  という状態は審査落ちの典型パターン

### "When In Use" → "Always" の二段階昇格

- iOSの標準パターンとして、まず`requestForegroundPermissionsAsync`
  （When In Use）を求め、バックグラウンド機能が必要になった時点で
  追加の説明とともに`requestBackgroundPermissionsAsync`（Always）へ
  昇格させるのが推奨される（Appleの[Human Interface
  Guidelines](https://developer.apple.com/design/human-interface-guidelines/patterns/accessing-private-data/)）。
  最初から"Always"を要求すると、ユーザーの不信・審査での説明要求につながりやすい
- "Always"を要求する場合は`NSLocationAlwaysAndWhenInUseUsageDescription`
  （`locationAlwaysAndWhenInUsePermission`、expo-locationプラグイン経由）
  が別途必須。無い状態で`requestBackgroundPermissionsAsync`を呼ぶと、
  iOSは「Alwaysに対応していないアプリ」として扱い、昇格ダイアログ自体が
  出ない

### 5.1.1(iii) データ最小化・5.1.1(i) プライバシーポリシー

- 機能に必要な範囲のデータのみ要求すること
- App Store Connectのメタデータ・アプリ内双方にプライバシーポリシーへの
  リンクが必須（保持・削除方針、同意撤回の方法を明記）

### App Privacy（プライバシー・ニュートリション・ラベル）

- App Store Connect提出時、位置情報（Precise Location）をどう収集・
  利用するかの質問票（Data Used to Track You / Data Linked to You等）に
  回答する必要がある。oruca は広告トラッキング（ATT）目的では位置情報を
  使わないため、App Tracking Transparencyのプロンプトは原則不要だが、
  「Location（Precise）」を「App Functionality」目的で収集している旨の
  申告は必要になる見込み

## Google Play

一次情報：
[Understanding location in the background permissions](https://support.google.com/googleplay/android-developer/answer/9799150)・
[Permissions and APIs that Access Sensitive Information](https://support.google.com/googleplay/android-developer/answer/16585319)

### スコープの最小化

> Request the minimum scope necessary (for example, coarse instead of fine,
> and foreground instead of background) based on actual feature needs.

- 現状の実装（`watchPositionAsync`、フォアグラウンド中心）は、結果的に
  このポリシーには抵触していない（まだバックグラウンド権限を要求して
  いないため）。**ただし`docs/architecture.md`の設計目標
  （`startGeofencingAsync`への切り替え）を実現すると、
  `ACCESS_BACKGROUND_LOCATION`が必要になり、以下の要件が発生する**

### `ACCESS_BACKGROUND_LOCATION`利用時に必要な4点セット

背景地位置情報を使う場合、Google Playに以下の提出が必須：

1. **Permissions Declaration Form**（Play Console上で、どの機能に
   バックグラウンド位置情報が必要かを申告）
2. **Video Demonstration**（該当機能の動作と、後述のプロミネント・
   ディスクロージャーを含む30秒以内の動画）
3. **Prominent In-App Disclosure**（後述）
4. **Privacy Policy**（PDFではなくアクティブなURL。アプリ内・ストア掲載
   ページの両方にリンク）

### Prominent In-App Disclosure（アプリ内の目立つ開示）の必須要件

- OSの権限ダイアログより**前**に、アプリ自身のダイアログで開示する
- 「location」という単語を明示的に使う
- バックグラウンドである旨を示す語（"background" / "when the app is
  closed" / "always in use" / "when the app is not in use"等）を含める
- バックグラウンド位置情報を使う機能を具体的に列挙する
- 設定・メニューに潜らせず、通常の利用フローの中で表示する
- 推奨されるテンプレート文言：
  > "This app collects location data to enable [feature], [feature], and
  > [feature] even when the app is closed or not in use."

- oruca にあてはめると、該当機能は「エリアへの入退室検知（ジオフェンス、
  US-004）」1点のみになる見込み。アプリを閉じていても入退室を検知する旨を
  明示する画面（権限リクエスト前のモーダル等）を用意する必要がある

### 禁止事項

> You should never request location permissions from users for the sole
> purpose of advertising or analytics.

- oruca は広告・分析目的で位置情報を使わない設計のため、この点は
  現状の設計と整合している

## oruca 固有のアクションアイテム

現在の実装状況（`app/hooks/useGeofenceMonitor.ts`・`app/app.config.js`）と
突き合わせた、対応が必要な項目。

| # | 項目 | 現状 | 対応が必要なタイミング |
|---|---|---|---|
| 1 | iOS "Always"権限の purpose string（`NSLocationAlwaysAndWhenInUseUsageDescription`） | 未設定（`locationWhenInUsePermission`のみ） | `startGeofencingAsync`移行時（Issue参照：`docs/architecture.md`「本開発着手時にやること」） |
| 2 | iOSの2段階昇格フロー（When In Use→Always） | 未実装（`requestForegroundPermissionsAsync`のみ呼んでいる） | 同上 |
| 3 | Android `isAndroidBackgroundLocationEnabled`（expo-locationプラグイン設定） | 未設定 | 同上 |
| 4 | Google Playの Permissions Declaration Form・動画提出 | 未着手 | ストア提出直前（バックグラウンド権限を使い始めてから） |
| 5 | Prominent In-App Disclosure画面（バックグラウンド位置情報の説明） | 未実装 | 同上。権限リクエスト前に表示する専用モーダルの新規UIが必要（別Issue化が必要） |
| 6 | プライバシーポリシーの作成・アプリ内外への掲載 | 未着手（Issue #29で検討中） | ストア提出前必須（Apple/Google共通） |
| 7 | App Store Connectの「App Privacy」質問票への回答 | 未着手 | ストア提出時 |
| 8 | purpose string（When In Use）の文言レビュー | 設定済み。「何のために」「エリア外では収集しない」旨を含み、ガイドライン5.1.1(ii)の「具体的に説明する」要件は現状満たしていると判断 | 文言変更時に再確認 |

### 優先度についての所感

現状（2026-10-01時点）はフォアグラウンド中心の`watchPositionAsync`で
動作しているため、上記1〜5（バックグラウンド権限関連）は**まだ審査に
提出できる状態ではない前提の項目**であり、`startGeofencingAsync`への
移行（`docs/architecture.md`「本開発着手時にやること」）と同じタイミングで
着手するのが合理的。6・7（プライバシーポリシー・App Privacy申告）は
バックグラウンド権限の有無に関わらず、ストア提出前には必須。

## 参考リンク

- [App Review Guidelines (Apple)](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines: Accessing Private Data (Apple)](https://developer.apple.com/design/human-interface-guidelines/patterns/accessing-private-data/)
- [Understanding location in the background permissions (Google Play)](https://support.google.com/googleplay/android-developer/answer/9799150)
- [Permissions and APIs that Access Sensitive Information (Google Play)](https://support.google.com/googleplay/android-developer/answer/16585319)
- [Access location in the background (Android Developers)](https://developer.android.com/develop/sensors-and-location/location/background)
