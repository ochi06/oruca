-- Issue #219（2026-10-02開発者確認、方針a）：
-- 友達追加（FRIENDSHIPS作成）しただけでは、相手のusers行（名前・アイコン）を
-- 読む権利が無く、友達一覧に名前が表示されない不具合を修正する。
--
-- 旧ポリシーは"users can read approved friends' profile"という名前の通り、
-- FRIEND_AREA_LINKS.status='approved'（特定エリアで名前つきで見せ合うという
-- エリア単位の個別合意、docs/schema.md参照）を条件にしていたが、これは
-- FRIENDSHIPS（単純な友達関係）とは別物であり、OTP交換はFRIEND_AREA_LINKS行を
-- 作らない。今後はFRIEND_AREA_LINKSの役割を「エリア単位の名前公開合意」のみに
-- 純化し、USERSのプロフィール閲覧自体はFRIENDSHIPSが存在するだけで許可する。

drop policy "users can read approved friends' profile" on users;

create policy "friends can read each other's profile" on users
  for select
  using (
    exists (
      select 1 from friendships
      where friendships.status = 'active'
        and (
          (friendships.user_id = auth.uid() and friendships.friend_id = users.id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = users.id)
        )
    )
  );
