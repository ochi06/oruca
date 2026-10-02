-- Issue #298: remove_friendship（Issue #276）がfriendshipsの2行を削除するのみで、
-- 同じ2人の間のfriend_area_links（Issue #221/#245）をクリーンアップしていなかった。
--
-- Issue #271で追加したarea_schedules/area_schedule_overridesのSELECTポリシーは
-- 「friend_area_linksが承認済み AND friendshipsにlocation_hidden=trueの行が無い」
-- という条件で許可するため、友達解除でfriendships自体が消えるとNOT EXISTS側が
-- 常に真になり、friend_area_linksのapproved行が残っていると友達解除後も
-- 相手の滞在予定が読めてしまっていた（プライバシー上のバグ、開発者確認済み）。
--
-- friend_area_linksとfriendshipsの間にFK関係は無い（initiator_id/friend_idで
-- 緩く対応づいているだけ）ため、ON DELETE CASCADEでは解決できない。
-- remove_friendshipと同じトランザクション内で、双方向のfriend_area_links行も
-- 明示的に削除する
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

  delete from friend_area_links
  where (initiator_id = auth.uid() and friend_id = p_friend_id)
     or (initiator_id = p_friend_id and friend_id = auth.uid());
end;
$$;
