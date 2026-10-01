-- Issue #183: オープングループは作成から7日（expires_at、Issue #148で
-- クライアント側がcreated_at+7日として作成時にセット済み）を過ぎたら
-- 自動削除する（クローズグループはexpires_atがnullのため対象外）。
-- group_membersはgroups.idへのon delete cascadeで既にカスケード削除される
-- （20260930170000_groups_and_rls.sql参照）ため、groupsの行を消すだけでよい。
--
-- app/lib/groups.tsのdeleteExpiredOwnedOpenGroups（Issue #148）は、owner自身が
-- アプリを開いたタイミングでしか削除されない弱点があった。本cronジョブは
-- ownerの操作に依存せず、全ユーザーのオープングループを対象に確実に削除する。
--
-- security definer関数（RLSをバイパスして実行される）経由にすることで、
-- 誰のauth.uid()にも紐付かないcronジョブからでも確実に全件を対象に削除できる。

create extension if not exists pg_cron with schema extensions;

create or replace function delete_expired_open_groups()
returns void
language sql
security definer
set search_path = public
as $$
  delete from groups
  where type = 'open'
    and expires_at is not null
    and expires_at <= now();
$$;

select
  cron.schedule(
    'delete-expired-open-groups',
    '0 * * * *', -- 毎時0分
    $$ select delete_expired_open_groups(); $$
  );
