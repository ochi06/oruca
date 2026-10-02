# ADR-0012: クラッシュレポート導入（Sentry）

## 決定事項

- `@sentry/react-native`（Expo公式config plugin `@sentry/react-native/expo`
  経由）を、本番リリース後のクラッシュ・エラー把握手段として導入する
  （Issue #27）
- DSNは`.env.development`/`.env.production`の`EXPO_PUBLIC_SENTRY_DSN`から
  注入する。未設定の場合は初期化をスキップし、Sentryプロジェクトを持たない
  環境でもアプリは問題なく起動する（`app/lib/sentry.ts`）
- 位置情報（緯度経度）などの機微データは、送信前に除去する
  （`app/utils/sentryScrub.ts`）：
  - `sendDefaultPii: false`でIPアドレス等のデフォルト収集を無効化
  - `beforeBreadcrumb`で、`areas`/`presence_logs`/`user_areas`への
    HTTPリクエストのbreadcrumb自体を記録しない
  - `beforeSend`で、イベント全体（extra/contexts/breadcrumbsのdata）から
    `lat`/`lng`/`latitude`/`longitude`系のキーを再帰的にredactする（多重防御）

## 理由

- React Native/Expoエコシステムで最も広く使われているクラッシュレポート
  サービスで、`@sentry/react-native/expo`というExpo公式config pluginが
  提供されており、導入コストが低い（開発者・司令塔チャットで確認済み）
- 無料枠（Developer プラン）で、個人開発・コンペ提出規模のイベント数は
  十分にまかなえる
- oruca は位置情報を扱うプライバシー重視のアプリであるという設計方針
  （`docs/oruca_PRD.md`）と矛盾しないよう、機微データの除去をライブラリの
  デフォルト設定に任せず、アプリ側で明示的に実装・テストした
  （`app/utils/sentryScrub.test.ts`）

## 見送った選択肢・未対応事項

- **EAS Build時のソースマップ自動アップロード**：`@sentry/react-native/expo`
  はビルド時に`organization`/`project`設定または環境変数
  （`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`）があればソースマップを
  自動アップロードできるが、現時点では`eas.json`・EAS Build自体が未整備
  （Issue #22, #23等で別途検討）のため、この段階では設定していない。
  EAS Build導入時に改めて設定する想定
- Bugsnag等の他サービスとの比較検討は行っていない（Issue本文の「たたき台」
  レベルの調査の上で、Expo公式サポートの有無を決め手にSentryを採用）

## 振り返り（2026-10-02追記、Issue #33）

- **良かった点**：機微データ（緯度経度）の除去を`beforeBreadcrumb`/
  `beforeSend`でアプリ側に明示実装し、ユニットテストまで書いた判断は
  そのまま効いている。DSN未設定を許容する設計（Sentryプロジェクトが
  無い環境でも起動する）も、ローカル開発・Web簡易体験版のいずれでも
  問題にならなかった。ただしDSN未設定時に`Sentry.wrap was called before
  Sentry.init`という警告が出る副作用があり、後日Issue #174で
  `Sentry.wrap`自体の適用を条件分岐するよう修正した（軽微な見落としだったが
  修正自体は小さく済んだ）
- **苦労した点**：本ADRの「見送った選択肢・未対応事項」に書いていた
  「EAS Build時のソースマップ自動アップロードは導入時に改めて設定する
  想定」という宿題を、実際にEAS Buildを導入したタイミング（ADR-0004）で
  拾い忘れ、初回ビルドが`SENTRY_ORG`等の未設定によるGradleタスク失敗で
  止まった。応急処置として`SENTRY_DISABLE_AUTO_UPLOAD=true`を
  `preview`環境限定で設定し、ソースマップ無しでもビルド自体は通る状態に
  した。本番向けの実際のSentry組織・プロジェクト・認証情報の設定は
  未着手のまま残っている
- **今作り直すなら変える点**：「後で設定する」と書いた項目をADR単体に
  残すのではなく、依存関係のある別ADR（本件ならADR-0004）側にも
  相互参照を書いておけば、導入時の拾い忘れを防げたはず（ADR-0004の
  振り返りにも同趣旨を記載）
