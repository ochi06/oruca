**（2026-10-03追記）今回の会場配布は見送り、将来タスクとして保留。以下は見送り前の検討内容。**

# 配信プラン（会場QR配布 → オープングループ参加）

2026-10-02〜03、司令塔チャットでのコード監査・調査結果をまとめたもの。
「会場でQRを配ってダウンロードしてもらい、開発者が事前に作成したオープン
グループに参加してもらう」という理想のデモ配信に対する、現状の到達度と
残作業の整理。

## 結論（要約）

- **アプリ機能自体は既に対応済み**：オープングループ・招待コード（QR表示・
  カメラでのQRスキャン・6桁コード手入力の両対応）・メール登録なしでの
  匿名参加、いずれも実装済み
- **会場配布の技術的な土台（EASビルド）も用意済み**：Android APK（EAS
  `preview`プロファイル）・iOS TestFlight配布の想定で`app/eas.json`が
  構成されている
- **配信を阻むのは実装ではなく、主に開発者側の判断・外部アカウント状態**
  （下記「残作業」参照）

## 現状の機能（実装済み）

| 項目 | 内容 | 実装箇所 |
|---|---|---|
| オープングループ | `GROUPS.type = 'open'`。エリア紐付け必須、`expires_at`で約7日後に自動削除（`delete_expired_open_groups()`） | `docs/schema.md`、Issue #148・#204・#183 |
| 招待コード・QR | オープングループは6桁の招待コードを持ち、QR表示される | `app/utils/groupInvite.ts` |
| QRスキャン／コード入力 | カメラでQRスキャン（`expo-camera`）・6桁コード手入力の両対応の統一画面 | `app/screens/friends/RedeemCodeScreen.tsx`（Issue #208） |
| 参加処理 | 招待コードでのオープングループ参加 | `app/store/useGroupStore.ts`（`joinOpenGroupByInviteCode`） |
| メール登録なしでの参加 | オープングループのみ、匿名ログイン（`signInAnonymously`）で参加可能。friendships作成・closedグループの作成/参加からはRLSで締め出される | `app/lib/auth.ts`、Issue #151、`supabase/migrations/20261001170000_anonymous_open_group_join.sql` |
| EASビルド設定 | `development`（開発クライアント）・`preview`（内部配布、AndroidはAPK直接ビルド）・`production`（ストア提出用） | `app/eas.json` |

## 重要な制約：QRは「ダウンロード」までは運んでくれない

現状、QRコードが運べるのは **「アプリを既に持っている人を、アプリ内の
招待コード入力画面まで連れて行く」** ところまで。ディープリンク
（`expo-linking`・Universal Links/App Links）は未設定（`app/app.config.js`に
`scheme`・`linking`設定なし）。そのため、「QRを読む→自動でアプリが
インストールされ→自動でそのグループに参加」という1枚のQRで完結する体験は、
現状では**実現しない**。

**会場での現実的な運用案（2枚使い）**：
1. **QR①：インストール導線**（EAS内部配布のインストールリンク、または
   TestFlightの公開リンク）
2. **QR②：オープングループの招待コード**（アプリを開いた後、
   `RedeemCodeScreen`でスキャン、または6桁コードを手入力）

ディープリンク対応（QR1枚化）は技術的には可能だが、Universal Links/App
Linksの設定・検証に別途工数がかかるため、今回は見送り、2枚QR運用を推奨。

## 残作業（配信に向けて）

### A. 開発者の判断・実行が必要なもの

1. **prod Supabaseプロジェクトの再開**（現在INACTIVE＝一時停止中）
   会場配布ビルドが`production`環境（`.env.production`）を指す場合、これが
   復帰していないとバックエンドに繋がらない。**未回答のまま**。
2. **Apple Developer Program登録状況の確認**（iOS配布に必須、有償・個人の
   Apple IDでの手続きが必要。AIは代行できない）
3. **プライバシーポリシーの要否・内容確定**（Issue #29、PR #227）
   TestFlightの外部テスター向け公開リンクを使う場合、Apple側のBeta App
   Reviewでプライバシーポリシーの提示を求められることが多い。会場配布が
   TestFlightの「内部テスター」の範囲で収まるなら必須ではないが、収容人数
   （内部テスターは招待制・上限あり）次第では外部テスター公開リンクが
   必要になり、その場合は実質必須になる
4. **Bundle ID**（Issue #201）：開発者確認済みで、preview/APK配布・
   TestFlight配布では仮IDのままで支障なし（**対応不要、ストア本提出まで
   保留でよい**）

### B. 実行すればすぐ終わる作業（developer判断が付き次第、実装チャットで対応可能）

5. `eas build --profile preview`（Android）・TestFlight向けビルドを実際に
   一度流し、QRインストールが問題なく動くかの実地検証（EASアカウント・
   Apple Developer資格情報が必要なため、developerと一緒に行う想定）
6. 会場用に、developerが事前にオープングループを1つ作成しておく
   （アプリの既存機能でそのまま可能、追加実装不要）

## 関連ドキュメント・Issue
- `docs/schema.md`（GROUPSテーブル、open/closed種別）
- `docs/decisions/0003-environments-and-branching.md`（dev/prod環境の切替）
- Issue #148, #204, #183, #208, #151（オープングループ・招待コード関連）
- Issue #190（簡易Web版、Apple Developer Program未登録時のフォールバック案）
- Issue #201（Bundle ID）、#29（プライバシーポリシー）、#30（ストア審査ガイドライン）、#23（EAS Submit）
