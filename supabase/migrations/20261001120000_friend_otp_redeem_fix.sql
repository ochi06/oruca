-- Issue #147: PR #145（Issue #143）のポストレビューで見つかった、
-- OTP友達追加まわりの不整合バグの修正。
--
-- 1) otp_codes.codeに衝突チェックが無く、`redeem_friend_otp`は
--    「codeの値が一致する最新の1件」を無条件に採用していたため、同時刻に
--    別人が偶然同じ6桁コードを持っていた場合、意図しない相手のコードを
--    誤ってredeemしうる。
--    → 「未消費（used_at is null）」なコードに限りcodeの一意性をDBレベルで
--      強制する（部分unique index。expires_atは時刻依存でindex述語に
--      使えないため、消費済みかどうかを表すused_atで区別する設計にした）。
--      これにより、衝突する2件目のinsertはDBレベルで失敗し、
--      アプリ側（issueMyOtp）でコードを振り直す
-- 2) `redeem_friend_otp`のfriendships作成が
--    `insert ... select ... where not exists (...)` という
--    check-then-actパターンで、friendshipsにunique制約が無かったため、
--    同一コードが多重に（連打・多重タップで）redeemされると、
--    READ COMMITTED下で競合し重複行が挿入されうる。
--    → friendshipsに unique(user_id, friend_id) を追加し、
--      insertを on conflict do nothing に置き換える（次のmigrationで
--      redeem_friend_otpを再定義）
alter table otp_codes
  add column used_at timestamptz;

create unique index otp_codes_code_active_idx
  on otp_codes (code)
  where used_at is null;

alter table friendships
  add constraint friendships_user_friend_unique unique (user_id, friend_id);
