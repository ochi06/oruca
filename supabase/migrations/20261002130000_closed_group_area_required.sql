-- Issue #204（2026-10-02開発者確認）：oruca自体が「エリア限定・関係限定の
-- 在席可視化アプリ」であることを踏まえ、closedグループにもarea_idの紐付けを
-- 必須にする。寿命（expires_at）は変更なし、引き続き'open'限定のまま。

alter table groups
  drop constraint groups_area_id_matches_type;

alter table groups
  add constraint groups_area_id_required check (area_id is not null);
