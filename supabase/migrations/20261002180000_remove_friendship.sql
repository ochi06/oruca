-- Issue #276 (US-008「削除」): 友達関係を双方向に解消する新規機能。
-- FRIENDSHIPSは片方向2行構成のため、クライアントから自分の行だけを
-- DELETEしても相手の行が残ってしまう（docs/schema.md「設計上の重要な
-- 原則」3番、2026-10-02開発者確認済み）。transfer_group_ownershipと
-- 同様のSECURITY DEFINER RPCで両方の行を一括・物理削除する。
--
-- アカウント退会時の全データ物理削除（Issue #228、delete-account Edge
-- Function）とは別物。こちらは通常操作としての「友達解除」で、
-- アカウント自体・他の友達関係は残る。削除後に再度友達になるには
-- 通常のOTP追加フローが必要（再追加時の特別な扱いは不要）。
create or replace function remove_friendship(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from friendships
  where (user_id = auth.uid() and friend_id = p_friend_id)
     or (user_id = p_friend_id and friend_id = auth.uid());
end;
$$;
