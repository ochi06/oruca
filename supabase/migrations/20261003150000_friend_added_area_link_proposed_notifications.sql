-- Issue #420（developer指示、2026-10-03、docs/schema.md反映済み）。
-- 友達追加（OTP交換成立時）・友達へのエリア紐づけ提案（friend_area_links作成時）が
-- NOTIFICATIONSに記録されておらず、通知ボックスに出てこなかったため、新しいtype
-- （friend_added・area_link_proposed）を追加する。

-- NOTIFICATIONS.typeのCHECK制約に新しい2種類を追加する
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('entry', 'want_to_meet', 'arrival_summary', 'group_invite', 'friend_added', 'area_link_proposed'));

-- friend_added：redeem_friend_otp内で直接作成する。friendshipsは双方向2行を
-- 同時に作るため、Database Webhookでは「どちらが招待する側/される側か」を
-- 行だけから判別できない。RPC内はauth.uid()（コードを読み取った側）・
-- v_otp.user_id（コードを発行した側）の向きが明確なため、ここで直接
-- 作成するのが最も確実（既存のgroup_invite等のWebhook＋Edge Functionパターンは
-- 単一方向の挿入イベントが前提のため、この場合は採用しない）。
-- 通知の受信者は「コードを発行しただけで、追加された側」（v_otp.user_id）
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

  insert into notifications (user_id, type, related_user_id)
    values (v_otp.user_id, 'friend_added', auth.uid());

  select name into v_friend_name from users where id = v_otp.user_id;

  return jsonb_build_object(
    'status', 'success',
    'friend_id', v_otp.user_id,
    'friend_name', coalesce(v_friend_name, '')
  );
end;
$$;
