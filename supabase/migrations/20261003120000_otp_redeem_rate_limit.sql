-- Issue #339（developer承認済み、2026-10-03）：redeem_friend_otp（OTP検証RPC、
-- security definer）に回数制限を加える。docs/security-review-checklist.md
-- 「redeem_friend_otpに試行回数・レート制限が無い点」への対策（ブルート
-- フォース対策が主目的）。
--
-- 失敗試行を記録する場所が既存テーブルに無いため、最小限の新規テーブル
-- otp_redeem_attemptsを追加する。RLSは有効化するがポリシーは追加しない
-- （redeem_friend_otpのsecurity definer経由でのみ読み書きし、一般ユーザーには
-- 一切公開しない）。
--
-- ウィンドウ方式：直近60秒間の失敗回数が10回を超えたら'rate_limited'を返す。
-- 60秒経過したらウィンドウをリセットする（固定ウィンドウ、厳密なスライディング
-- ウィンドウではないが、ブルートフォース抑止の目的には十分）。成功時は
-- カウントをリセットする

create table otp_redeem_attempts (
  user_id uuid primary key references users(id) on delete cascade,
  attempt_count int not null default 0,
  window_started_at timestamptz not null default now()
);

alter table otp_redeem_attempts enable row level security;

create or replace function redeem_friend_otp(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp otp_codes%rowtype;
  v_friend_name text;
  v_attempt otp_redeem_attempts%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if (auth.jwt() ->> 'is_anonymous')::boolean is true then
    return jsonb_build_object('status', 'forbidden');
  end if;

  insert into otp_redeem_attempts (user_id)
    values (auth.uid())
    on conflict (user_id) do nothing;

  select * into v_attempt from otp_redeem_attempts where user_id = auth.uid() for update;

  if v_attempt.window_started_at <= now() - interval '60 seconds' then
    update otp_redeem_attempts set attempt_count = 0, window_started_at = now()
      where user_id = auth.uid();
    v_attempt.attempt_count := 0;
  end if;

  if v_attempt.attempt_count >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select *
    into v_otp
    from otp_codes
    where code = p_code and used_at is null
    for update;

  if not found then
    update otp_redeem_attempts set attempt_count = attempt_count + 1 where user_id = auth.uid();
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_otp.expires_at <= now() then
    update otp_codes set used_at = now() where id = v_otp.id;
    update otp_redeem_attempts set attempt_count = attempt_count + 1 where user_id = auth.uid();
    return jsonb_build_object('status', 'expired');
  end if;

  if v_otp.user_id = auth.uid() then
    update otp_redeem_attempts set attempt_count = attempt_count + 1 where user_id = auth.uid();
    return jsonb_build_object('status', 'self');
  end if;

  update otp_codes set used_at = now() where id = v_otp.id;

  insert into friendships (user_id, friend_id)
    values (auth.uid(), v_otp.user_id)
    on conflict (user_id, friend_id) do nothing;

  insert into friendships (user_id, friend_id)
    values (v_otp.user_id, auth.uid())
    on conflict (user_id, friend_id) do nothing;

  update otp_redeem_attempts set attempt_count = 0, window_started_at = now()
    where user_id = auth.uid();

  select name into v_friend_name from users where id = v_otp.user_id;

  return jsonb_build_object(
    'status', 'success',
    'friend_id', v_otp.user_id,
    'friend_name', coalesce(v_friend_name, '')
  );
end;
$$;
