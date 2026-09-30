# ADR-0011: 環境変数・シークレット管理方針

## 決定事項

### ローカル開発（`.env.development` / `.env.production`）

- どちらも`.gitignore`対象（`app/.gitignore`で除外済み）。リポジトリには
  コミットしない
- 値そのものは各開発者（現状は一人）のローカルにのみ置き、共有が必要な場合は
  1Password・LastPassのような共有シークレット管理ツール経由で渡す（Slack・
  チャットへの直接貼り付けはしない）
- `EXPO_PUBLIC_`プレフィックスを付けた変数は、ビルド時にJSバンドルへ
  そのまま埋め込まれ、アプリを解析すれば誰でも読める状態になる
  （`~/dev-notes.md`「Expo環境変数」参照）。よって、あくまで
  **「クライアントに公開してよい値」専用**とし、以下の基準で判断する：
  - Supabaseの`anon key`：`EXPO_PUBLIC_`でよい。Supabase自体がこのキーを
    クライアント埋め込み前提で設計しており、実際のアクセス制御はRLSが担う
  - `service role key`（RLSを迂回できる管理者キー）：**絶対に
    `EXPO_PUBLIC_`を付けない。そもそもクライアント（`app/`）の
    `.env*`・コードに含めない**。将来サーバー側処理（Supabase Edge
    Functionsなど）が必要になった場合も、Edge Functions側のみに
    環境変数として設定し、クライアントには渡さない
  - `GOOGLE_MAPS_API_KEY`：現状`EXPO_PUBLIC_`を付けていない
    （ネイティブ側のビルド設定でのみ参照し、JSバンドルには埋め込まない）。
    ただしAPIキー自体はビルド済みアプリ内に残るため、Google Cloud Console側で
    アプリのbundle ID/パッケージ名・APIによる制限をかけることが必須
    （未設定の場合は別途対応する）

### CI/CDサービス側（EAS Build、`docs/decisions/0004-build-automation.md`）

- EAS Buildには**EAS環境変数**という管理機能があり、`eas.json`に平文で
  書く方式より優先して使う：
  - `eas env:create` でExpoダッシュボード側にプロジェクト単位・
    環境単位（development/preview/production等）の変数として登録する
  - 各変数にはvisibility（`plaintext` / `sensitive` / `secret`）を設定できる。
    `service role key`のような値は`secret`（登録後はダッシュボード上でも
    値を再表示できない）にする
  - ビルド実行時にEAS側が対象プロファイルの環境変数を自動で注入するため、
    `eas.json`自体やリポジトリには値を書かない
  - ローカル開発用に`eas env:pull`でリモートの値を`.env.development`等へ
    同期することもできるが、これは開発者の手元にコピーを作る操作である点は
    変わらないため、上記のローカル管理ルールと同じ扱いとする
- 実際の`eas.json`作成・EAS環境変数の登録は、EAS Build未導入の現時点では
  未着手（`docs/decisions/0004`決定時点ではまだ`eas.json`自体が存在しない）。
  導入時にハンズオンで一緒に設定する

## 理由

- `EXPO_PUBLIC_`の挙動（ビルドに埋め込まれ誰でも見える）を正しく理解した
  上で「公開してよい値かどうか」を毎回判断する必要があるため、判断基準を
  明文化しておく
- Codemagic等の汎用CI/CDは`docs/decisions/0004`で既に見送り済みのため、
  本ADRではEAS Build側のシークレット管理機能のみを対象とする
- service role keyのようなRLSを迂回できる値は、クライアントアプリの
  ビルド成果物に一切含めない（含めた場合、アプリを解析されるだけで
  全データへの管理者アクセスを渡すことになる）のが大前提であり、
  「EXPO_PUBLIC_を付けない」だけでは不十分（ビルド成果物に一切含めない）
  ことを明記した

## 未決定・今後の検討

- EAS Buildの導入（`eas init` / `eas build:configure`）自体は別Issueで
  ハンズオンで行う。本ADRはその際に従う運用ルールの取り決めのみ
- `GOOGLE_MAPS_API_KEY`のGoogle Cloud Console側のアプリ制限設定は未実施。
  別途対応する

## 参考

- `docs/decisions/0003-environments-and-branching.md`
- `docs/decisions/0004-build-automation.md`
- `~/dev-notes.md`「Expo環境変数」の節
