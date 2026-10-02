-- Issue #330（docs/oruca_PRD.md US-017）：FRIENDSHIPS.want_to_meetを
-- 恒久的なウォッチリスト化させないための2つの制約。
--
-- ①5人上限：クライアント側のUI（Issue #243）だけでなく、DBレベルで
-- 強制する。単一行のCHECK制約では「ある行以外のwant_to_meet=trueの件数」を
-- 数えられないため、トリガー関数で実装する
create or replace function enforce_want_to_meet_limit()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  if new.want_to_meet and (tg_op = 'INSERT' or not old.want_to_meet) then
    select count(*) into current_count
    from friendships
    where user_id = new.user_id and want_to_meet = true;

    if current_count >= 5 then
      raise exception 'want_to_meet limit reached (max 5)';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_want_to_meet_limit_trigger
  before insert or update on friendships
  for each row
  execute function enforce_want_to_meet_limit();

-- ②24時（JST）リセット：恒久的なウォッチリストにしないため、毎日
-- 全ユーザー分のwant_to_meetをfalseに戻す。delete_expired_open_groups()
-- （20261001175000_open_group_auto_delete.sql）と同じsecurity definer関数
-- + pg_cronパターン。pg_cronはUTCで動作するため、JST 24:00（＝翌0:00）は
-- UTC 15:00として指定する
create or replace function reset_want_to_meet_daily()
returns void
language sql
security definer
set search_path = public
as $$
  update friendships
  set want_to_meet = false
  where want_to_meet = true;
$$;

select
  cron.schedule(
    'reset-want-to-meet-daily',
    '0 15 * * *', -- 毎日15:00 UTC = 24:00（翌0:00）JST
    $$ select reset_want_to_meet_daily(); $$
  );
