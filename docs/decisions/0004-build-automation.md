# ADR-0004: ビルド自動化（EAS Build）

## 決定事項

実機ビルド・ストア配布の自動化には **EAS Build（+ EAS Submit）** を採用する。

## 理由

- `docs/decisions/0003-environments-and-branching.md`が既にEAS Buildの
  ビルドプロファイル運用（`eas.json`でdevelopment/production等を定義し、
  プロファイルごとに環境変数を注入）を前提に書かれており、追加の設計変更が
  不要
- Expo公式サービスのため、Expo SDK・`app.json`/`app.config.ts`との統合が
  シームレスで、追加のYAML設定がほぼ不要（`eas.json`のみ）
- 無料枠（月iOS 15件+Android 15件）が個人開発・demo/dev/prod少数プロファイル
  の運用規模には十分。Codemagicの分単位課金（月500分）より、本数ベースの
  方が消費が読みやすい
- `eas submit`でTestFlight・Google Play内部テストへの提出まで一気通貫で
  Expoエコシステム内に閉じられ、証明書・APIキー管理もExpoアカウントに
  紐づく形で一括管理できる
- 開発者はモバイル開発歴約1年・CI/CD未経験のため、設定ファイルが`eas.json`
  1つで完結し日本語ドキュメントも充実しているEAS Buildの方が学習コストが低い

## 見送った選択肢

- **Codemagic**：汎用CI/CDのため`codemagic.yaml`を自前で組む必要があり、
  Expo特有の挙動（EAS Update、OTA更新等）は自前で追う必要がある。
  汎用CI/CD（YAMLベースのワークフロー定義）の経験自体は面接で語れる知識だが、
  コンペ提出という締め切りがある中では優先度を下げた。将来ネイティブ
  モジュールを多用して`expo prebuild`でbareワークフロー化する場合や、
  ビルド時間・カスタマイズ性がボトルネックになった場合の代替候補として
  記録しておく。

## 参考

- Issue #22での調査コメント：https://github.com/Greek-Academy/oruca/issues/22

## 振り返り（2026-10-02追記、Issue #33）

- **良かった点**：`eas.json`1つでプロファイル（`preview`：internal
  distribution、APK直接配布）を定義でき、学習コストの低さという選定理由が
  そのまま効いた。EAS Environment Variables（`eas env:set`）でプロファイル
  ごとに環境変数を分離でき、ADR-0011で決めた「`service role key`は
  クライアントに含めない」方針もそのまま運用できている
- **苦労した点**：初回ビルドが、`@sentry/react-native/expo`
  （ADR-0012）のビルド時ソースマップ自動アップロードタスクで失敗した
  （`An organization ID or slug is required`）。ADR-0012側で「EAS Build
  導入時に改めて設定する想定」と書いていた宿題を、実際にEAS Buildを
  導入するタイミングで拾い忘れていたのが原因。`SENTRY_DISABLE_AUTO_UPLOAD`
  環境変数で回避したが、本番用のSentry組織・認証情報の設定自体は
  まだ未着手（ADR-0012参照）
- 無料枠（月iOS 15件+Android 15件）は、現時点（開発終盤）まで一度も
  上限に達していない。選定時の想定通り、個人開発の規模には十分だった
- **今作り直すなら変える点**：ADR間の依存（「このADRの宿題はあのADR導入時に
  拾う」）を、各ADR本文に“TODO”として残すだけでなく、実際に着手した時に
  チェックリスト化して拾い漏れを防ぐ仕組みがあればよかった
