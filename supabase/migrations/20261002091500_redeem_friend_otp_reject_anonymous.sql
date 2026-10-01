-- Issue #200: redeem_friend_otp（SECURITY DEFINER、friendshipsへの実INSERT経路）は
-- RLSを完全にバイパスするため、Issue #151でfriendshipsに追加したRESTRICTIVEな
-- 「匿名アカウントはfriendshipsを作成できない」ポリシーがこの経路には一切効かず、
-- 匿名セッションでも友達追加（OTP交換）ができてしまっていた。
--
-- RPC本体の冒頭で、呼び出し元が匿名セッションかどうかを明示チェックし拒否する
-- （開発者承認済み、2026-10-02、Issue #200）。拒否時の返り値は、アプリ内の
-- 他の権限拒否パターン（useGroupStore.ts等）と同じ status='forbidden' に揃える。
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

  if (auth.jwt() ->> 'is_anonymous')::boolean is true then
    return jsonb_build_object('status', 'forbidden');
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
