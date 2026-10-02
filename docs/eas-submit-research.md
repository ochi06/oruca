# EAS Submit 調査メモ・手動申請との使い分け方針たたき台（Issue #23）

**位置づけ**：ビルド自動化自体は`docs/decisions/0004-build-automation.md`で
EAS Build（+EAS Submit）に決定済み。本ドキュメントはその続き、EAS Submit
固有の仕組み・必要な認証情報・運用方針のたたき台。**Apple Developer
Program自体への登録はまだ**のため、iOS側の設定作業は未着手。本ドキュメントは
調査結果の整理であり、実際の認証情報登録・`eas.json`の`submit`プロファイル
拡充は、Apple Developer Program登録後に別途ハンズオンで行う
（`docs/decisions/0011-secrets-management.md`と同じ方針）。

## 1. EAS Submitの仕組み

- `eas submit --platform ios` / `--platform android` で、EAS Buildで作った
  ビルド成果物（または手元の`.ipa`/`.aab`）をApp Store Connect・
  Google Play Consoleへアップロードするコマンド
- `eas build --auto-submit` とすることで、ビルド完了後に自動でSubmitまで
  連続実行できる（本番ビルド＋自動申請を1コマンドにまとめられる）
- **重要**：EAS Submitが行うのは「ストアへのアップロード」までで、
  **審査に出す（Submit for Review）操作自体は含まれない**。
  - iOS：アップロードされたビルドはTestFlightで配信可能になるが、本番
    審査に出すボタンはApp Store Connect上で別途手動（または別のAPI経由）
  - Android：内部テスト（internal testing）トラックへの配置まではAPI経由で
    完結できるが、本番トラックへのロールアウト（公開）操作は別途Play
    Console上の操作が必要（`eas submit`の`track`設定で内部テスト/本番等の
    投入先トラックは選べるが、「公開する」の最終操作とは別）
- 設定は`eas.json`の`submit`プロファイル（現状`production: {}`のみで、
  認証情報は未設定）に記述する。環境変数・シークレットと同様、認証情報
  そのものは`eas.json`に書かず、EASのシークレット管理機能
  （`docs/decisions/0011-secrets-management.md`参照）または対応する
  鍵ファイルパスの指定で扱う

## 2. 必要な認証情報

### 2-1. iOS（App Store Connect）

**前提**：Apple Developer Program（年額$99）への登録が必須。EAS側の設定を
進める前に、まずこの登録を済ませる必要がある（本Issueの調査時点では未登録）。

認証方式は2通りあるが、**App Store Connect APIキー方式を推奨**する
（Expo公式ドキュメントも現在はこちらを推奨。Apple ID + アプリ用パスワード
方式は2段階認証との相性が悪く非推奨）。

- **App Store Connect APIキー**：App Store Connect →
  ユーザーとアクセス（Users and Access）→ 統合（Integrations）→
  App Store Connect API から発行する。以下の3点が必要：
  - Issuer ID
  - Key ID
  - 秘密鍵ファイル（`.p8`、**発行時に一度しかダウンロードできない**点に注意）
  - 発行には「App Manager」以上の権限を持つアカウントが必要
- 初回のアプリ登録（Bundle IDの登録、App Store Connect上でのApp作成）は、
  EAS Submitだけでは完結しない場合がある。`eas build:configure`や
  `eas submit`実行時に未登録なら自動作成を試みるが、組織のApple Developer
  アカウント設定次第では手動でのBundle ID登録・App作成が必要になることが
  ある（実際にやってみないと確定しない部分。Apple Developer Program登録後に
  要検証）

### 2-2. Android（Google Play Console）

- **サービスアカウントのJSON鍵**が必要。手順の概要：
  1. Google Play Console →設定 → API アクセス から、リンクされた
     Google Cloudプロジェクトを作成（または既存のものをリンク）
  2. Google Cloud Console側でサービスアカウントを新規作成し、JSON形式の
     鍵をダウンロードする
  3. Play Console側で、そのサービスアカウントに権限を付与する（最低限
     「製品版、確認済みのデバイスを除外した公開、Play App Signingの使用」
     相当の権限、対象アプリへのアクセス権）
  4. ダウンロードしたJSON鍵を`eas.json`の`submit.production.android.serviceAccountKeyPath`
     で参照するか、EASのシークレットとして登録する
- **重要な制約**：Google Playは**不正利用防止のため、新規アプリの初回公開は
  Play Console上での手動操作を要求する**。具体的には、アプリを一度も
  公開したことが無い状態では、Google Play Developer API経由のアップロードが
  拒否されることがある（最低1回は手動でAPK/AABをアップロードし、内部テスト
  トラックなどで公開実績を作る必要がある）。つまり、**oruca
  の初回リリースは手動申請、2回目以降のアップデートからEAS Submitを
  使う**という流れが現実的

## 3. 手動申請との使い分け方針（たたき台）

1. **初回リリースは両OSとも手動申請する。**
   - iOS：App Store Connect APIキー自体の発行・動作確認を兼ねて、最初の
     TestFlightビルドまではXcode/Transporterでの手動アップロードで様子を見る
   - Android：上記2-2の制約により、初回は手動アップロードが事実上必須
2. **2回目以降のTestFlight・内部テストへの配信は`eas submit`（または
   `eas build --auto-submit`）で自動化する。** ビルド→ストアへの
   アップロードまでを1コマンドにし、手作業によるミスを減らす
3. **本番審査への提出（Submit for Review）・本番公開（ロールアウト）は、
   当面は手動のままにする。** 理由：
   - 審査に出す前の最終確認（スクリーンショット・説明文・バージョン情報の
     見直し）は人の目でのダブルチェックを残したいため（Issue #31の
     ストア掲載情報と内容が synced しているか等）
   - 個人開発・提出数も少ない段階では、自動化のメリットよりも
     「誤って早期に審査提出してしまう」事故のリスクの方が大きい
4. **CI/CDパイプライン（GitHub Actions等からの`eas submit`呼び出し）への
   本格組み込みは、当面見送る。** まずはローカル（開発者の手元）から
   `eas submit`を手動実行する運用に留め、認証情報の扱いに慣れてから
   GitHub Actions連携を検討する（`docs/decisions/0011-secrets-management.md`
   のEAS環境変数の仕組みをCI経由でも使う場合、GitHub Actions側に
   `EXPO_TOKEN`等を追加で安全に保持する設計が必要になるため、段階を分ける）

## 4. 今後のTODO

- [ ] Apple Developer Program（年額$99）への登録
- [ ] 登録後、App Store Connect APIキーの発行（Issuer ID・Key ID・`.p8`）
- [ ] Google Play Consoleでのサービスアカウント作成・権限付与・JSON鍵発行
- [ ] 初回リリース（手動申請）を両OSとも1回通す
- [ ] `eas.json`の`submit`プロファイルに認証情報を設定し、2回目以降の
      TestFlight・内部テスト配信で`eas submit`の動作を検証する
- [ ] 本ドキュメントの内容が実際の手順と齟齬が無いか、初回設定時に
      見直して`docs/decisions/`配下のADRとして昇格するか判断する
      （現時点ではたたき台のため`docs/`直下に置いている）
