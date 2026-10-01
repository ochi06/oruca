-- Issue #148: グループにクローズ/オープン種別を追加する。
-- クローズ：友達を介した招待制（既存のGROUP_MEMBERS招待・承諾フロー、変更なし）。
-- オープン：イベントなど、管理者が発行するinvite_codeをQR等で読み込むだけで
-- 承認不要・即座に参加できるグループ（area_id・expires_at必須）。
-- 2026-10-01、司令塔チャットで開発者確認済み（Issue #148コメント参照）。

alter table groups
  add column type text not null default 'closed' check (type in ('closed', 'open')),
  add column area_id uuid references areas(id) on delete set null,
  add column expires_at timestamptz;

-- type='open'はイベント会場(area_id)が必須、'closed'はarea_idを持たない
-- （area_idを使ったグループ単位の在席共有設計は別Issueで引き続き検討中のため、
-- 今のところ'open'限定のこの用途にのみ使う）
alter table groups
  add constraint groups_area_id_matches_type check (
    (type = 'open' and area_id is not null)
    or (type = 'closed' and area_id is null)
  );

-- GROUP_MEMBERS INSERT: 既存の「自己申請(pending)」「owner/承認済みメンバーからの招待」に加え、
-- オープングループへのQR参加（status='approved'を自己INSERT）を許可する
drop policy "users can request to join or be invited by owner/members" on group_members;

create policy "users can request to join or be invited by owner/members"
  on group_members for insert
  with check (
    (user_id = auth.uid() and status = 'pending' and invited_by is null)
    or (
      user_id = auth.uid()
      and status = 'approved'
      and invited_by is null
      and exists (
        select 1 from groups
        where groups.id = group_members.group_id
          and groups.type = 'open'
      )
    )
    or (
      invited_by = auth.uid()
      and (
        exists (
          select 1 from groups
          where groups.id = group_members.group_id
            and groups.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from group_members gm2
          where gm2.group_id = group_members.group_id
            and gm2.user_id = auth.uid()
            and gm2.status = 'approved'
        )
      )
    )
  );

-- invite_codeでグループを検索してQR参加する際、参加前のユーザーはまだ
-- groups.SELECT RLS（owner/is_public/承認済みメンバー）を満たさない。
-- invite_code自体が「知っていれば参加してよい」秘密情報であるため
-- （docs/schema.md GROUPS参照）、security definerで「type='open'の
-- グループに限って」invite_codeから最小限の情報だけを返す関数を用意する
-- （redeem_friend_otpと同じ考え方。全open groupsを一覧できる緩いSELECT
-- ポリシーにはしない）
create or replace function find_open_group_by_invite_code(p_invite_code text)
returns table (id uuid, name text, area_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select groups.id, groups.name, groups.area_id
  from groups
  where groups.invite_code = p_invite_code
    and groups.type = 'open'
    and (groups.expires_at is null or groups.expires_at > now());
$$;
