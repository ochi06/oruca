# セキュリティレビューチェックリスト（提出・リリース前）

コンペ提出前、および今後の大きめのリリース前に、このチェックリストを一通り
確認する。`docs/schema.md`の設計原則（特に「設計上の重要な原則」節）を
崩していないかどうかも合わせて見る。

## 1. RLS（Row Level Security）棚卸し

- [x] `supabase/migrations/`内の`create table`と`enable row level security`が
      1対1で対応しているか確認する（新しいテーブルを追加した際、RLS有効化を
      書き忘れていないか）
  ```bash
  grep -n "^create table" supabase/migrations/*.sql
  grep -n "enable row level security" supabase/migrations/*.sql
  ```
- [x] 各テーブルのポリシーに`using (true)`・`with check (true)`のような
      無条件許可が無いか確認する（意図的に公開する用途──例：
      `avatars are publicly readable`──を除く。除く場合はコメントで
      理由が書かれているか確認する）
  ```bash
  grep -n "using (true)\|with check (true)" supabase/migrations/*.sql
  ```
- [x] 名前・アイコンなど個人情報を返すSELECTポリシーが、必ず承認条件を
      経由しているか確認する（`docs/schema.md`「設計上の重要な原則」2.参照。
      Issue #219以降、`USERS`行自体の読み取り可否は`FRIENDSHIPS.status =
      'active'`ベースに変更されている点に注意。`FRIEND_AREA_LINKS.status =
      'approved'`は、マップ等で在席マーカーに**名前を表示してよいか**という
      クライアント側の別の判定にのみ使う、役割が異なる条件）
- [x] 新規に追加したRPC（`security definer`関数）が、RLSを意図的に
      バイパスする理由を持っているか確認する。バイパスが必要なのは基本的に
      「自分の権限だけでは他人の行を読み書きできないが、業務上必要な処理」
      （例：`redeem_friend_otp`）に限る
  ```bash
  grep -n "security definer" supabase/migrations/*.sql
  ```

### 棚卸し結果（2026-10-02時点、mainブランチ30c418c）

現行mainのテーブルはすべてRLS有効化済み（`create table`12件・
`enable row level security`12件で1対1対応）：`users`・`areas`・`user_areas`・
`friendships`・`friend_area_links`・`otp_codes`・`presence_logs`・`groups`・
`group_members`・`notifications`・`area_schedules`・`area_schedule_overrides`。
`using (true)`の無条件許可はテーブル側に無し（`avatars are publicly
readable`のみ例外だが、アバター画像を公開する意図で妥当）。

`security definer`関数はすべて目的が明確でスコープも適切：
`redeem_friend_otp`（OTP交換、Issue #147/#200で強化済み）・
`is_group_owner`/`is_approved_group_member`/`is_open_group`（RLS循環参照回避
のための読み取り専用ヘルパー、Issue #177）・
`find_open_group_by_invite_code`（invite_code一致＋type='open'限定の最小列
のみ返却、Issue #148）・`delete_expired_open_groups`（pg_cronからの期限切れ
オープングループ一括削除、Issue #183）・`transfer_group_ownership`（現owner
確認＋新owner承認済みメンバー確認後のみ実行、Issue #198）・
`protect_group_members_self_update`（本人の表示名/アイコン更新は許可しつつ、
group_id/user_id/invited_by/不正なstatus遷移はトリガーで個別に禁止、
Issue #199）。いずれも越権操作は確認できなかった。

**🔴 重大な発見：dev DB（oruca-dev）に、mainの直近7件のmigrationが未適用**
（`npx supabase migration list --linked`で確認、2026-10-02）。対象：
`20261002090000`(#197)・`20261002091500`(#200)・`20261002120000`(#202)・
`20261002130000`(#204)・`20261002140000`(#199)・`20261002150000`(#219)・
`20261002155000`(#214)。実機検証で、friendshipsがactiveな友達同士でも
相手の`users`行が読めない（#219の修正が反映されていない）ことを確認した。
原因はコードの不具合ではなく、**マイグレーション適用漏れ（運用上のギャップ）**。
開発者に報告済み、対応（`supabase db push --linked`等）は開発者判断待ち。

## 2. OTP（友達追加）の耐性

- [x] コード長・失効時間が意図通りか確認する（`app/utils/otp.ts`の
      `OTP_CODE_LENGTH`・`OTP_TTL_MS`）
- [x] コード衝突時の挙動を確認する（同時刻に2人が同じコードを持つ場合、
      `redeem_friend_otp`が正しい相手のみにマッチするか。Issue #147で
      `used_at`ベースの行ロック方式に修正済み──
      `supabase/migrations/20261001120100_friend_otp_redeem_rpc_v2.sql`参照）
- [x] `redeem_friend_otp`に試行回数・レート制限が無い点を許容できるか判断する。
      現状は「6桁（100万通り）× 60秒TTL」の組み合わせのみが総当たりへの
      抑止力で、RPC呼び出し自体への回数制限は無い。個人開発・小規模利用が
      前提のコンペ提出物として許容するか、Supabase側のレート制限
      （例：Edge Functionでのthrottle）を追加するかを判断する
- [x] 二重redeemで友達関係が重複作成されないか確認する
      （`friendships(user_id, friend_id)`のunique制約＋`on conflict do nothing`。
      Issue #147で対応済み）
- [x] 匿名セッションからの`redeem_friend_otp`呼び出しが拒否されるか確認する
      （Issue #200、`status='forbidden'`。拒否時にOTPコードを消費しない実装に
      なっているかも合わせて確認）

### 棚卸し結果（2026-10-02時点）

6桁数字・60秒TTL（`app/utils/otp.ts`で変更無しを確認）。`redeem_friend_otp`は
Issue #147の修正でコード衝突・多重redeem問題を解消済み（行ロック＋`used_at`
管理＋`friendships`のunique制約）、Issue #200の修正で匿名セッションからの
呼び出しも`forbidden`で拒否される（コード側のPR #207検証時に確認済み。ただし
上記1.の通りdev DBへの該当migration=20261002091500は未適用のため、dev環境では
実際にはまだ有効化されていない点に注意）。RPC呼び出し自体のレート制限は
未実装（許容する方針で問題ないか、最終的には開発者判断）。

## 3. anon keyでの実アクセス確認

提出前に一度、実際にanon keyでSupabase REST APIを直接叩き、
「ログインしていない状態で読めてはいけないデータが読めないか」を確認する。

- [x] 未認証（Authorizationヘッダ無し）で各テーブルにSELECTを投げ、
      空配列またはエラーが返ることを確認する
  ```bash
  curl "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/users?select=*" \
    -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"
  ```
- [x] 認証済み（別ユーザーのJWT）で、承認していない相手・監視していない
      エリアのデータが見えないことを確認する
- [x] Storage（avatars）で、意図した範囲以外のファイルパスに
      書き込み・上書きができないことを確認する（`users can upload their own
      avatar`ポリシーがパス内のuser_idとauth.uid()を突き合わせているか）

この項目はdev環境で実施する（prod/demoに対しては行わない）。実施はリリース都度
手動で行う想定（自動テスト化は将来の検討課題、Issue化は別途）。

### 実施結果（2026-10-02時点、dev環境＝oruca-dev）

- 未認証：`users`・`presence_logs`・`friendships`・`groups`・`otp_codes`の
  いずれも`[]`（空配列）。問題無し
- 認証済み・別ユーザーJWTでの実アクセス：admin APIでテスト用アカウントの
  セッションを発行し（`generate_link`→`verify`でJWT取得、対象ユーザーを
  個別指定する形に限定し、全ユーザー一覧取得のような広範なadmin呼び出しは
  避けた）、以下を確認
  - 自分が監視していないエリアの`presence_logs`は見えない（`[]`）
  - 自分の`friendships`行（自分がuser_idまたはfriend_id側）のみ見える
  - 友達（`friendships.status='active'`）の`users`行が見えない事象を確認 →
    上記1.の「dev DB migration未適用」が原因と判明（コード側の不具合ではない）
- Storage：他人の`avatars/{user_id}/`フォルダへのPOSTは403
  `row-level security policy`で拒否。自分のフォルダへの書き込みは成功
  （テスト後に削除済み、本番avatarsバケットへの汚染無し）

## 3.5 データ投入時の権限境界（今回新たに確認）

開発者要望によるdev環境へのテストデータ投入（テスト友達アカウント4件・
friendships・presence_logs）はservice_roleキーで実施した。その際、
「全ユーザーのメールアドレス一覧を取得する」ような広範囲のadmin API呼び出しは
行わず、対象ユーザー（開発者本人の`auth.uid()`）を名指しで取得する最小権限の
クエリに限定した。service_roleキーはこのセッション内のみで使用し、
リポジトリ・ドキュメントには値を記載していない。

## 4. その他

- [x] `.env.production`のservice role keyがクライアント（`app/`）のビルド成果物に
      含まれていないことを確認する（`docs/decisions/0011-secrets-management.md`
      参照）
  → `app/`配下のソース・`app.config.js`に`service_role`/`SERVICE_ROLE`の
    参照は無し。`.env.development`/`.env.production`は`app/.gitignore`で
    除外済み
- [x] 依存パッケージに既知の脆弱性が無いか確認する
  ```bash
  cd app && npm audit --omit=dev
  ```
  → 17件（moderate 8・high 9）検出。すべて`@expo/cli`・
    `@expo/config-plugins`・`xcode`・`node-forge`等、**ビルド時のみ使用する
    Expoツールチェーン側の脆弱性**で、ビルド済みアプリのバンドルに含まれる
    ランタイム依存（`@supabase/supabase-js`・`react-native`本体等）には
    該当しないことを確認した。`npm audit fix --force`は`expo`自体のバージョン
    ダウングレードを伴う破壊的変更のため、現時点では対応を見送り、許容する
    （開発機のビルド環境が侵害された場合のリスクであり、エンドユーザーの
    端末・配布物には影響しない）
- [ ] prod環境のDBバックアップ（`supabase db dump --linked`）を取得する
      （`docs/decisions/0013-backup-and-disaster-recovery.md`参照）
      → **未実施**：Supabaseダッシュボード側の操作・prodプロジェクトへの
        接続情報が必要なため、本レビューでは実施不可。開発者が別途実施
- [ ] prodプロジェクトがSupabaseダッシュボード上で一時停止（pause）していないか
      確認する（Freeプランは7日間無操作で自動一時停止するため、
      `docs/decisions/0013-backup-and-disaster-recovery.md`参照）
      → **未実施**：ダッシュボード確認が必要なため、本レビューでは実施不可。
        開発者が別途実施

## 参考

- `docs/schema.md`「設計上の重要な原則」
- `docs/decisions/0007-auth-anonymous.md`
- `docs/decisions/0009-auth-email-magic-link.md`
- `docs/decisions/0010-auth-email-otp-code.md`
- `docs/decisions/0011-secrets-management.md`
- `docs/decisions/0013-backup-and-disaster-recovery.md`
