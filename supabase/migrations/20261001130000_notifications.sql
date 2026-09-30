-- Issue #160（Issue #126で設計したNOTIFICATIONSの実装）。
-- docs/schema.md L134-143の定義通りにcreate table。RLSはpresence_logs/
-- otp_codesと同じ「本人の行のみ操作可能」パターン（新規の設計判断は不要、
-- Issue #160本文で確認済み）。INSERTは想定していない：通知はservice role
-- （Edge Function、Issue #131のDatabase Webhookパターン）側でのみ作成し、
-- クライアントからの直接INSERTは許可しない（INSERT用ポリシーを設けない）。

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('entry', 'want_to_meet', 'arrival_summary', 'group_invite')),
  related_user_id uuid references users(id) on delete set null,
  area_id uuid references areas(id) on delete set null,
  group_member_id uuid references group_members(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "users can read their own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "users can mark their own notifications as read"
  on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
