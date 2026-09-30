-- Issue #147（続き）：redeem_friend_otpを、新しい制約（otp_codes.used_at・
-- friendshipsのunique(user_id, friend_id)）を前提にした安全な実装に置き換える。
--
-- 変更点：
-- - コードは「code = p_code and used_at is null」で一意に特定できるように
--   なったため、"order by created_at desc limit 1"のような曖昧な選択をやめる
-- - for updateで行ロックし、同一コードへの同時redeemを直列化する
--   （READ COMMITTED下でも、ロック取得後にused_atがnullでなくなっていれば
--   その時点でWHERE述語を満たさなくなり「行が見つからない」扱いになる）
-- - 検証結果が確定した時点（期限切れ・成功）でused_atを立てて即座に消費済みに
--   する。自分自身のコードだった場合は「使われた」わけではないので消費しない
-- - friendshipsのinsertは on conflict (user_id, friend_id) do nothing に
--   置き換え、check-then-actの競合を無くす
create or replace function redeem_friend_otp(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp otp_codes%rowtype;
  v_friend_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
    into v_otp
    from otp_codes
    where code = p_code and used_at is null
    for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_otp.expires_at <= now() then
    update otp_codes set used_at = now() where id = v_otp.id;
    return jsonb_build_object('status', 'expired');
  end if;

  if v_otp.user_id = auth.uid() then
    return jsonb_build_object('status', 'self');
  end if;

  update otp_codes set used_at = now() where id = v_otp.id;

  insert into friendships (user_id, friend_id)
    values (auth.uid(), v_otp.user_id)
    on conflict (user_id, friend_id) do nothing;

  insert into friendships (user_id, friend_id)
    values (v_otp.user_id, auth.uid())
    on conflict (user_id, friend_id) do nothing;

  select name into v_friend_name from users where id = v_otp.user_id;

  return jsonb_build_object(
    'status', 'success',
    'friend_id', v_otp.user_id,
    'friend_name', coalesce(v_friend_name, '')
  );
end;
$$;
