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
