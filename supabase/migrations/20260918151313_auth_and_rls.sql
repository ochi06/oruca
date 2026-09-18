-- ADR-0007（匿名ログイン）に基づき、usersをauth.usersに紐付け、
-- 最低限のRLSポリシーを追加する。

alter table users
  add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- USERS: 自分の行は読み書きできる。他人の名前・アイコンは
-- FRIEND_AREA_LINKSが承認済みの相手のみ読める
create policy "users can manage their own row"
  on users for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can read approved friends' profile"
  on users for select
  using (
    exists (
      select 1 from friend_area_links
      where status = 'approved'
        and (
          (initiator_id = auth.uid() and friend_id = users.id)
          or (friend_id = auth.uid() and initiator_id = users.id)
        )
    )
  );

-- AREAS: 所有者は自分のエリアを読み書きできる。監視対象（USER_AREAS）に
-- 登録しているエリアは読める
create policy "owners can manage their own areas"
  on areas for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "monitored areas are readable"
  on areas for select
  using (
    exists (
      select 1 from user_areas
      where user_areas.area_id = areas.id and user_areas.user_id = auth.uid()
    )
  );

-- USER_AREAS: 自分の監視登録のみ読み書きできる
create policy "users can manage their own user_areas"
  on user_areas for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- FRIENDSHIPS: 自分が関わる行のみ読み書きできる
create policy "users can manage their own friendships"
  on friendships for all
  using (user_id = auth.uid() or friend_id = auth.uid())
  with check (user_id = auth.uid());

-- FRIEND_AREA_LINKS: 自分が関わる行のみ読み書きできる
create policy "users can manage their own friend_area_links"
  on friend_area_links for all
  using (initiator_id = auth.uid() or friend_id = auth.uid())
  with check (initiator_id = auth.uid());

create policy "friends can approve links proposed to them"
  on friend_area_links for update
  using (friend_id = auth.uid())
  with check (friend_id = auth.uid());

-- OTP_CODES: 自分宛のコードのみ読み書きできる
create policy "users can manage their own otp_codes"
  on otp_codes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- PRESENCE_LOGS: 自分の入退室は読み書きできる。友達のログは、
-- 監視対象エリア(USER_AREAS)にいる場合のみ在席有無を読める
-- （名前表示可否はアプリ側でFRIEND_AREA_LINKSを別途確認する。
-- docs/schema.md「設計上の重要な原則」2.参照）
create policy "users can manage their own presence_logs"
  on presence_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "presence in monitored areas is readable"
  on presence_logs for select
  using (
    exists (
      select 1 from user_areas
      where user_areas.area_id = presence_logs.area_id and user_areas.user_id = auth.uid()
    )
  );
