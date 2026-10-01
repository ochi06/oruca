-- Issue #150: グループ単位の一時的な表示名・アイコン設定。
-- 設定されている場合、そのグループ内のメンバー一覧・在席表示ではUSERS.name/
-- icon_urlの代わりにこちらを使う（未設定時は通常通りUSERS側にフォールバック）。
-- 新規のRLSポリシーは不要（既存group_membersのRLSがこの2列も含め保護する）。

alter table group_members
  add column display_name text,
  add column display_icon_url text;
