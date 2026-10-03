# セキュリティレビューチェックリスト（提出・リリース前）

コンペ提出前、および今後の大きめのリリース前に、このチェックリストを一通り
確認する。`docs/schema.md`の設計原則（特に「設計上の重要な原則」節）を
崩していないかどうかも合わせて見る。

## 1. RLS（Row Level Security）棚卸し

- [ ] `supabase/migrations/`内の`create table`と`enable row level security`が
      1対1で対応しているか確認する（新しいテーブルを追加した際、RLS有効化を
      書き忘れていないか）
  ```bash
  grep -n "^create table" supabase/migrations/*.sql
  grep -n "enable row level security" supabase/migrations/*.sql
  ```
- [ ] 各テーブルのポリシーに`using (true)`・`with check (true)`のような
      無条件許可が無いか確認する（意図的に公開する用途──例：
      `avatars are publicly readable`──を除く。除く場合はコメントで
      理由が書かれているか確認する）
  ```bash
  grep -n "using (true)\|with check (true)" supabase/migrations/*.sql
  ```
- [ ] 名前・アイコンなど個人情報を返すSELECTポリシーが、必ず
      `FRIEND_AREA_LINKS.status = 'approved'`（またはそれに相当する承認条件）を
      経由しているか確認する（`docs/schema.md`「設計上の重要な原則」2.参照）
- [ ] 新規に追加したRPC（`security definer`関数）が、RLSを意図的に
      バイパスする理由を持っているか確認する。バイパスが必要なのは基本的に
      「自分の権限だけでは他人の行を読み書きできないが、業務上必要な処理」
      （例：`redeem_friend_otp`）に限る
  ```bash
  grep -n "security definer" supabase/migrations/*.sql
  ```

### 棚卸し結果（2026-10-01時点、mainブランチ8b91149）

現行mainのテーブルはすべてRLS有効化済み：`users`・`areas`・`user_areas`・
`friendships`・`friend_area_links`・`otp_codes`・`presence_logs`
（`supabase/migrations/20260918150538_initial_schema.sql`）。`using (true)`の
無条件許可は無し（`avatars are publicly readable`のみ例外だが、アバター画像を
公開する意図で妥当）。

未マージPRで`groups`・`group_members`テーブルのRLS追加が進行中（Issue #144、
PR #146）。マージ時に本チェックリストで再確認すること。

## 2. OTP（友達追加）の耐性

- [ ] コード長・失効時間が意図通りか確認する（`app/utils/otp.ts`の
      `OTP_CODE_LENGTH`・`OTP_TTL_MS`）
- [ ] コード衝突時の挙動を確認する（同時刻に2人が同じコードを持つ場合、
      `redeem_friend_otp`が正しい相手のみにマッチするか。Issue #147で
      `used_at`ベースの行ロック方式に修正済み──
      `supabase/migrations/20261001120100_friend_otp_redeem_rpc_v2.sql`参照）
- [x] `redeem_friend_otp`に試行回数・レート制限を追加した（Issue #339、
      2026-10-03開発者確認済み）。新規テーブル`otp_redeem_attempts`で
      ユーザーごとの失敗回数を記録し、直近60秒間に10回失敗したら
      `rate_limited`を返す（`supabase/migrations/
      20261003120000_otp_redeem_rate_limit.sql`参照）。あわせてOTP発行
      （`otp_codes` insert）にも間隔制限（直近60秒5件まで）を追加した
      （`supabase/migrations/20261003110000_otp_issue_rate_limit.sql`参照）
- [ ] 二重redeemで友達関係が重複作成されないか確認する
      （`friendships(user_id, friend_id)`のunique制約＋`on conflict do nothing`。
      Issue #147で対応済み）

### 棚卸し結果（2026-10-03時点）

6桁数字・60秒TTL。`redeem_friend_otp`はIssue #147の修正でコード衝突・多重redeem
問題を解消済み（行ロック＋`used_at`管理＋`friendships`のunique制約）。
RPC呼び出し自体のレート制限はIssue #339で実装済み（直近60秒間10回失敗で
`rate_limited`、OTP発行も直近60秒5件まで）。

## 3. anon keyでの実アクセス確認

提出前に一度、実際にanon keyでSupabase REST APIを直接叩き、
「ログインしていない状態で読めてはいけないデータが読めないか」を確認する。

- [ ] 未認証（Authorizationヘッダ無し）で各テーブルにSELECTを投げ、
      空配列またはエラーが返ることを確認する
  ```bash
  curl "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/users?select=*" \
    -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"
  ```
- [ ] 認証済み（別ユーザーのJWT）で、承認していない相手・監視していない
      エリアのデータが見えないことを確認する
- [ ] Storage（avatars）で、意図した範囲以外のファイルパスに
      書き込み・上書きができないことを確認する（`users can upload their own
      avatar`ポリシーがパス内のuser_idとauth.uid()を突き合わせているか）

この項目はdev環境で実施する（prod/demoに対しては行わない）。実施はリリース都度
手動で行う想定（自動テスト化は将来の検討課題、Issue化は別途）。

## 4. その他

- [ ] `.env.production`のservice role keyがクライアント（`app/`）のビルド成果物に
      含まれていないことを確認する（`docs/decisions/0011-secrets-management.md`
      参照）
- [ ] 依存パッケージに既知の脆弱性が無いか確認する
  ```bash
  cd app && npm audit --omit=dev
  ```
- [ ] prod環境のDBバックアップ（`supabase db dump --linked`）を取得する
      （`docs/decisions/0013-backup-and-disaster-recovery.md`参照）
- [ ] prodプロジェクトがSupabaseダッシュボード上で一時停止（pause）していないか
      確認する（Freeプランは7日間無操作で自動一時停止するため、
      `docs/decisions/0013-backup-and-disaster-recovery.md`参照）

## 参考

- `docs/schema.md`「設計上の重要な原則」
- `docs/decisions/0007-auth-anonymous.md`
- `docs/decisions/0009-auth-email-magic-link.md`
- `docs/decisions/0010-auth-email-otp-code.md`
- `docs/decisions/0011-secrets-management.md`
- `docs/decisions/0013-backup-and-disaster-recovery.md`
