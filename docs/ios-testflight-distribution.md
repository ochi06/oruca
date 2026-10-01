# iOS配布手順（Apple Developer Program登録〜TestFlight外部テスター向け公開リンク発行）

ブース展示・コンペ提出に向けたiOS配布のための調査メモ。アカウント登録・各種
同意・実際のビルド/提出操作は開発者本人が行う想定で、ここでは手順の整理・
事前に把握しておくべき所要時間や注意点をまとめる（このドキュメント自体は
調査・整理のみで、実装・実際の操作は行っていない）。

技術スタック側の前提（EAS Build/Submitを使う）は
`docs/decisions/0004-build-automation.md`で決定済み。

## 全体の流れ

1. Apple Developer Programへの登録（開発者本人）
2. App Store Connectでのアプリレコード作成（開発者本人、Bundle ID確定後）
3. EAS側の認証情報設定（`eas credentials -p ios`、対話形式）
4. EAS Buildでビルド（`eas build -p ios --profile production`）
5. EAS Submitでアップロード（`eas submit -p ios --profile production --id <BUILD_ID>`、
   または`eas build --auto-submit`で3〜4を一括実行）
6. TestFlightでのビルド処理待ち（Apple側の自動処理・コンプライアンス確認）
7. 内部テスター or 外部テスターグループの設定
8. 外部テスターの場合：Beta App Review（簡易版の審査）を通過させる
9. 外部テスターグループに公開リンク（Public Link）を発行する

## 1. Apple Developer Programへの登録

- 登録先：https://developer.apple.com
- 年額$99（個人/組織どちらのプランでも同額、組織の場合はD-U-N-S番号の確認が
  追加で必要になり、その分時間がかかることがある）
- **審査・反映に数日〜1週間程度かかる場合がある**（特に初回登録時）ため、
  展示会・締切から逆算して早めに着手する必要がある
- 個人アカウントであれば、Apple ID（二要素認証有効化が必須）があれば登録自体は
  即日申し込み可能。支払い確認後、承認までの待ち時間が発生する

## 2. App Store Connectでのアプリレコード作成

Apple Developer Program登録が承認された後に行う。

- Bundle ID（例：現状`app.config.js`は仮の`com.example.oruca`になっており、
  本番配布前に正式なBundle IDへの変更が必要。これは「Must完了後に再検討する」
  とapp.config.js内のコメントに既に記載されている既知のTODO）
- App情報（Primary Language、SKU、Bundle ID紐付け）
- この時点ではApp Store向けの詳細なメタデータ（スクリーンショット・説明文等）
  は未入力でもTestFlightの提出自体は進められる（本提出＝App Store公開審査とは
  別物）

## 3. EAS側の認証情報設定

```bash
eas credentials -p ios
```

対話形式で以下を設定する：
- 配布証明書（Distribution Certificate）の作成・選択
- プロビジョニングプロファイルの作成・選択
- App Store Connect APIキーの設定（推奨。2段階認証のプロンプトをCI/CD等で
  回避できる）

APIキーを使わずApple ID単体で行う方法もあるが、EAS公式はAPIキー方式を推奨。

## 4〜5. ビルド・提出

```bash
# ビルド（提出は別コマンドで行う場合）
eas build --platform ios --profile production --non-interactive

# ビルドIDを指定して提出
eas submit --platform ios --profile production --id <BUILD_ID> --non-interactive

# 一括で行う場合
eas build --platform ios --profile production --auto-submit
```

`eas.json`の`submit.production.ios`に`appleId`・`ascAppId`・`appleTeamId`
（またはAPIキー情報）を設定しておく必要がある。`ascAppId`はApp Store Connect
の「App情報」→「Apple ID」欄で確認できる。

現状の`eas.json`は未作成（`docs/decisions/0011-secrets-management.md`
「未決定・今後の検討」に記載の通り、EAS Build自体がまだ未導入）。導入時に
ハンズオンで設定する。

## 6. TestFlightでのビルド処理

- アップロード後、Appleのサーバー側で自動処理（ウイルススキャン・
  コンプライアンスチェック等）が走る。数分〜数十分程度かかることがある
- `eas submit:status --platform ios --profile production --json --non-interactive`
  で処理状況を確認できる（App Store Connect APIキーの設定が別途必要）
- 処理完了後も、実際にテスターのTestFlightアプリにビルドが表示されるまでには
  グループへの割り当てが必要（後述）

## 7. 内部テスター vs 外部テスター

| | 内部テスター | 外部テスター |
|---|---|---|
| 上限人数 | 100人 | 10,000人 |
| 対象者 | App Store Connectの同じチーム（Apple Developer Programの
  メンバー・管理者として招待された人）に限る | 誰でも（メールアドレス指定の
  個別招待、または公開リンク経由） |
| 審査 | 不要（即座に利用可能） | **Beta App Review**が必要（軽量版の審査。
  通常は本審査より早いが、それでも時間がかかる） |
| ビルド有効期限 | 90日 | 90日 |

ブース展示で不特定多数（身近な人以外も含む可能性がある来場者）に配りたい
場合は外部テスター・公開リンクが必要になる。「身近な人」に限定するなら、
全員をApple Developer Programのチームメンバーとして追加できる範囲であれば
内部テスターでも足りるが、通常は招待の手間・人数上限の観点で外部テスターの
公開リンクの方が運用しやすい。

## 8. Beta App Reviewの通過

- 外部テスターグループに初めてビルドを割り当てる際（またはアプリの大きな
  変更時）に自動的にトリガーされる
- 通常の App Store 本審査より短時間で完了することが多いが、**保証された
  所要時間ではない**ため、展示会当日ギリギリでの提出は避け、数日前には
  一度外部テスターへの割り当てを試みておくべき
- 審査落ちした場合の典型的な理由（アプリ説明の不足、クラッシュ、
  プレースホルダーコンテンツの残存等）はApp Store本審査と共通する部分が多い

## 9. 公開リンク（Public Link）の発行

App Store Connect上の操作（EAS CLIの範囲外）：

1. App Store Connect → 対象アプリ → TestFlight タブ
2. 外部テスターグループを作成（未作成の場合）
3. Beta App Reviewを通過したビルドをそのグループに割り当てる
4. グループ設定内の「Public Link」をONにすると、URLが発行される
5. このURLを共有すれば、受け取った人はTestFlightアプリ経由でインストールできる
   （Apple IDでのサインインとTestFlightアプリ自体のインストールは来場者側で必要）

## 注意点・リスク

- **Apple Developer Program登録の審査待ち期間が一番の不確定要素**。展示会の
  日程が決まっているなら、逆算して最優先で着手する必要がある
- Bundle IDを`com.example.oruca`のような仮の値のまま提出することはできない
  （正式なBundle IDへの変更が事前に必要）
- Beta App Reviewも「早ければ即日〜数日」の幅があり確約できない。余裕を持った
  スケジュールが必要
- 来場者側もTestFlightアプリのインストール＋Apple IDでのサインインが必要
  （Web簡易体験版（Issue #190）はこの手間を回避するための保険として並走
  している）
- Android側（Google Play内部テスト）は別途`docs/decisions/0004`のEAS Submit
  フローで対応可能。本ドキュメントはiOS/TestFlightに限定

## 参考

- `docs/decisions/0004-build-automation.md`
- `docs/decisions/0011-secrets-management.md`
- [TestFlight overview（Apple公式）](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Add internal testers（Apple公式）](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)
- [EAS Submit for iOS（Expo公式）](https://docs.expo.dev/submit/ios/)
