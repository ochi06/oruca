-- Issue #143: OTPコード（US-005）を実データで検証し、FRIENDSHIPSを作成するRPC。
--
-- FRIENDSHIPSは1関係につき2行（user_id→friend_id）で表現するが、既存RLS
-- （20260918151313_auth_and_rls.sql）の with check (user_id = auth.uid()) は
-- 「自分がuser_id側の行」しか作れない。OTP入力者（自分）は自分の行は直接
-- insertできても、相手側の行（user_id=相手, friend_id=自分）は相手のクライアント
-- でなければ作れず、対面でのその場限りのやり取りというUXに反する。
-- また otp_codes も「自分の行のみ」RLSのため、相手が発行したコードをそのまま
-- 読むこともできない。
--
-- そのため、この関数はSECURITY DEFINERでRLSをバイパスし、
-- 1) コードの検証（存在・失効・自分自身のコードでないか）
-- 2) 両方向のFRIENDSHIPS行の作成（既に存在する場合は何もしない＝冪等）
-- をアトミックに行う。呼び出し元はauthenticatedロールのみに限定する。
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
    where code = p_code
    order by created_at desc
    limit 1;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_otp.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  if v_otp.user_id = auth.uid() then
    return jsonb_build_object('status', 'self');
  end if;

  insert into friendships (user_id, friend_id)
    select auth.uid(), v_otp.user_id
    where not exists (
      select 1 from friendships where user_id = auth.uid() and friend_id = v_otp.user_id
    );

  insert into friendships (user_id, friend_id)
    select v_otp.user_id, auth.uid()
    where not exists (
      select 1 from friendships where user_id = v_otp.user_id and friend_id = auth.uid()
    );

  select name into v_friend_name from users where id = v_otp.user_id;

  return jsonb_build_object(
    'status', 'success',
    'friend_id', v_otp.user_id,
    'friend_name', coalesce(v_friend_name, '')
  );
end;
$$;

-- Supabaseはfunction作成時にデフォルト権限でanon/authenticated/service_roleへ
-- EXECUTEを付与するため、"from public"だけでは不十分（anonへの直接付与は
-- 残ってしまう）。未ログインのクライアントから呼べないよう、anonから明示的に
-- 剥奪する
revoke all on function redeem_friend_otp(text) from public;
revoke execute on function redeem_friend_otp(text) from anon;
grant execute on function redeem_friend_otp(text) to authenticated;
