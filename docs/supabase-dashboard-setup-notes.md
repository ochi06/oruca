# Supabaseダッシュボード手動設定メモ

CLI・migrationだけでは完結せず、Supabaseダッシュボード上での手動操作が
必要な設定をまとめる。環境（dev/demo/prod）ごとに同じ手順を繰り返す必要が
ある点に注意（Edge FunctionのURLが環境ごとに異なるため、Database Webhookの
設定はmigrationに含めていない。`docs/architecture.md`参照）。

## 1. Database Webhook設定手順（group_members INSERT → send-group-invite-notification）

Issue #163で追加した`group_members`への新規招待通知を配信するための設定。
既存の`presence_logs INSERT → send-entry-notifications`（Issue #131）と
同じ手順なので、そちらを設定したことがあれば流れは同じ。

### 前提：Edge Functionのデプロイ（Webhook設定より先に必要）

Database WebhookはデプロイされたEdge FunctionのURLを指定する方式のため、
**先にデプロイが終わっていないとWebhook側で選択できない**。

```bash
cd supabase
supabase functions deploy send-group-invite-notification --project-ref <対象プロジェクトref>
supabase functions deploy send-entry-notifications --project-ref <対象プロジェクトref>
```

- `<対象プロジェクトref>`は環境ごとのプロジェクトref（dev=`hohnwoczbtfzytynmvag`、
  demo/prodは別途確認）
- **2026-10-02時点、dev環境（oruca-dev）は`supabase functions list`で
  確認したところ両方とも未デプロイ（0件）。Webhookの設定以前に、まず
  デプロイ自体が必要な状態**
- デプロイ後、`supabase functions list --project-ref <ref>`で2関数とも
  表示されることを確認する

### ダッシュボードでの設定手順

1. [Supabase Dashboard](https://supabase.com/dashboard)で対象プロジェクト
   （例：oruca-dev）を開く
2. 左メニューの **Database** → **Webhooks** を開く
3. **Create a new hook** をクリック
4. 以下を入力する
   - **Name**：`send-group-invite-notification`（管理しやすい名前なら任意）
   - **Table**：`group_members`
   - **Events**：`Insert` のみにチェック（`Update`・`Delete`は外す。
     招待以外のINSERT以外のイベントでEdge Functionを無駄に起動しないため）
   - **Type of webhook**：`Supabase Edge Functions`
   - **Edge Function**：プルダウンから`send-group-invite-notification`を選択
     （前提のデプロイが完了していればここに表示される）
   - **HTTP Method**：`POST`（デフォルトのまま）
   - **HTTP Headers**：デフォルトのままでよい（Supabaseが`Authorization`
     ヘッダーにservice role相当の権限を自動付与する）
5. **Create webhook** で保存する
6. 動作確認：アプリから実際にグループへ友達を招待し（`invited_by`付きの
   INSERT）、招待された本人に`group_invite`通知（`NOTIFICATIONS`テーブルの
   行・プッシュ通知）が届くか確認する。自己申請・QR自己参加の場合
   （`invited_by is null`）は通知が**来ない**のが正しい動作（Edge Function
   内で除外している）

### 同じ手順で`presence_logs INSERT → send-entry-notifications`も設定する

Table・Edge Function名を読み替えるだけで同じ手順。こちらは`Events`も
`Insert`のみ（`presence_logs`への`UPDATE`＝位置更新・退室では発火させない）。

## 2. `supabase config push`が実際に変更する設定項目

`supabase config push`は、ローカルの`supabase/config.toml`に**明示的に
書かれている値のみ**をリモートプロジェクトに反映するコマンド。
`supabase config diff --project-ref <ref>`で事前に差分を確認できる
（`push`を打つ前に必ず確認すること。CLIの`--help`にも「非対話実行では
確認なしで反映されてしまうので、事前にdiffを見るように」という趣旨の
警告がある）。

### 比較対象スコープ

`config diff`の出力によると、比較対象は`api`・`auth`・`database`・
`pooler`・`realtime`・`storage`の6カテゴリ。Edge Functions自体の設定や
Database Webhookの設定はこのスコープに含まれない（＝`config push`では
Webhookは設定されない。1.の手順は別途手動で行う必要がある）。

### 2026-10-02時点で確認した、ローカルとdev（oruca-dev）の差分

`npx supabase config diff --project-ref hohnwoczbtfzytynmvag`で確認した
実際の差分（`push`した場合に変更される項目）：

| 項目 | ローカル（config.toml） | 現在のdev（remote） | `push`した場合 |
|---|---|---|---|
| `auth.enable_anonymous_sign_ins` | `true` | `false` | `true`になる（匿名ログイン＝オープングループQR参加が有効化される） |
| `auth.email.enable_confirmations` | `true` | `false` | `true`になる。**要注意**：Issue #237（新規ユーザー初回ログインに標準リンク型メールが届く不具合）の原因がこの設定だった。現在は`auth.email.template.confirmation`（`supabase/templates/confirmation.html`）のカスタムテンプレート追加で解消したとされるため、再度`true`にしても#237が再発しないか要確認 |
| `auth.email.template.email_change.subject` | `oruca アカウント登録コード` | `Confirm your new email address`（Supabaseデフォルト） | ADR-0010のカスタム件名が反映され、標準件名から切り替わる |
| `auth.sms.twilio.enabled` | `false` | `true` | `false`になる（oruca未使用の機能のため実害は無い見込みだが、意図せず無効化される点は認識しておく） |

### `push`しても変わらない・`push`では扱えない項目

- `auth.email.smtp.*`（host/port/user/sender_name等）：ローカルに未宣言の
  ため`push`対象外（`remote_only`として表示されるだけで上書きされない）。
  現在のdev環境はResend（`smtp.resend.com`）経由で送信する設定が**既に
  ダッシュボード側で直接設定されている**。この設定はconfig.tomlで管理
  されていないため、環境を作り直す際は改めてダッシュボードでの手動設定が
  必要になる点に注意
- `storage.image_transformation.enabled`：同様にローカル未宣言のため対象外
- Database Webhook・Edge Functionsのデプロイ：上記1.の通り別経路

### 推奨する運用

1. `push`前に必ず`supabase config diff --project-ref <ref>`で差分を確認する
2. 差分のうち「ローカルの意図通りの値」のみを反映したい場合、`config.toml`
   側を先に見直してから`push`する（全部まとめて反映すると、意図しない
   項目まで変わる。例えば上記の`auth.sms.twilio.enabled`のように、
   こちらが意識していない項目まで一緒に変わってしまう）
3. 本番（prod）環境に対しては特に、`diff`の内容を人間が目視確認してから
   `push`する（非対話実行では確認なしで反映されるため、誤操作のリスクが
   高い）
