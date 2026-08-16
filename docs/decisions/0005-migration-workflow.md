# ADR-0005: Supabaseマイグレーション運用

## 決定事項

Supabase CLIの標準マイグレーション機能に乗せ、「SQLファイルをGit管理 →
CLIでdev/prodへ手動反映」という最小構成にする。

### 置き場所

`supabase/`はリポジトリ直下（`app/`と並列）に置く。DBスキーマは`app/`専用の
資産ではなく、`docs/schema.md`同様プロジェクト全体で共有する設計情報のため。

```
/supabase/
  config.toml              # supabase init で生成
  migrations/
    <timestamp>_<name>.sql  # supabase migration new が自動採番
  seed.sql                  # ローカル開発用のダミーデータ（任意）
```

### ローカル開発の流れ

```bash
supabase init                        # 初回のみ
supabase start                       # ローカルDB（Docker）起動
supabase migration new create_users  # マイグレーションファイル生成
supabase db reset                    # 全マイグレーションを頭から適用し直す
```

### dev / prod への反映

```bash
supabase link --project-ref <devプロジェクトのref>
supabase db push
# 動作確認後
supabase link --project-ref <prodプロジェクトのref>
supabase db push
```

- 反映順序はローカル確認→dev→（確認後）prod
- 一人開発のためCIによる自動デプロイは組まず、都度手動で`supabase db push`する
- プロジェクトref・DBパスワード等の接続情報は`.env`ではなく`supabase link`時の
  ログイン情報として渡し、リポジトリにはコミットしない

### 運用ルール

- スキーマ変更は必ず`supabase migration new`でファイルを作る（Studio上で
  直接SQLを叩いた場合も、後からマイグレーションファイルとして追記する）
- 一度prodに適用したマイグレーションファイルは書き換えない（直したい場合は
  新しいファイルを追加する。Gitコミット履歴と同じ「追記のみ」の考え方）
- `docs/schema.md`は「設計の正」、`supabase/migrations/`は「実行履歴」という
  役割分担にする。スキーマ変更時は両方を同じPRで更新する

## 理由

- Supabase CLI標準のフローに乗ることで、個人開発でも複数ブランチ作業時の
  ファイル名衝突を避けやすく、覚える概念が少なくて済む
- マイグレーションファイルをGit管理することで、`demo/dev/prod`（現在は
  dev/prod）の複数環境に同じスキーマを同じ手順で再現できる

## 見送った選択肢

- 連番方式（`0001_xxx.sql`）でのファイル命名：Supabase CLI標準の
  タイムスタンプ自動採番の方が、複数ブランチ作業時の採番衝突を避けやすい
- CI（GitHub Actions）での自動`db push`：一人開発の現段階では過剰。
  将来必要になった時点で検討する
- ロールバック用マイグレーション：Must系User Story実装中はテーブル追加が
  中心のため、当面は見送る

## 参考

- Issue #24での調査コメント：https://github.com/Greek-Academy/oruca/issues/24
