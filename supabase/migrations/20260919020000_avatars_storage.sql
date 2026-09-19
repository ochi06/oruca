-- Issue #34: プロフィールアイコン用のStorageバケットとRLSポリシー。
-- 一般的なサービス（GitHub/Slack/Xなど）と同様、アイコンは公開読み取り・
-- 本人のみ書き込み可とする方針（開発者と確認済み）。
-- パスは `{user_id}/icon.<拡張子>` とし、storage.foldername(name)の
-- 第1要素（フォルダ名）がauth.uid()と一致する場合のみ書き込みを許可する。

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
