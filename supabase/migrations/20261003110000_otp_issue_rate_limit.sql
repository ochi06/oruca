-- Issue #339（developer承認済み、2026-10-03）：otp_codesへのinsert（OTP発行、
-- app/lib/friends.tsのissueMyOtp）に間隔制限を加える。
-- docs/security-review-checklist.md「RPC呼び出し自体のレート制限は未実装」の
-- うち、OTP発行側の対策。直近60秒以内に同一user_idが作成した行が5件以上
-- ある場合はinsertを拒否する（通常利用では60秒TTLごとに1回しか発行しない
-- ため、正規利用には影響しない）

create or replace function enforce_otp_issue_rate_limit()
returns trigger
language plpgsql
as $$
declare
  v_recent_count int;
begin
  select count(*) into v_recent_count
    from otp_codes
    where user_id = new.user_id
      and created_at > now() - interval '60 seconds';

  if v_recent_count >= 5 then
    raise exception 'otp_issue_rate_limited';
  end if;

  return new;
end;
$$;

create trigger otp_codes_rate_limit
  before insert on otp_codes
  for each row
  execute function enforce_otp_issue_rate_limit();
