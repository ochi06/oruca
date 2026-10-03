-- Issue #422（developer指示、2026-10-03、docs/schema.md反映済み）。
-- 運営からの全ユーザー向けお知らせ機能。ユーザー単位の行は持たず、
-- メッセージ1件につき1行のシンプルなテーブル。投稿用の管理画面は作らず、
-- developerがSupabaseダッシュボードから直接INSERTする運用。既読管理は
-- DBで持たず、クライアント側（AsyncStorage）で「最後に見たお知らせのid」
-- だけを端末ローカルに保持する簡易方式（app/lib/announcements.ts参照）。

create table announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

-- 公開情報扱い。INSERT/UPDATE/DELETE用のポリシーは設けない
-- （service role経由のみ、developerがダッシュボードから直接操作する）
create policy "announcements are readable by anyone"
  on announcements for select
  using (true);
