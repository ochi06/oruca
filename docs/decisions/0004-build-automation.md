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
