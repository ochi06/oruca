// docs/schema.md の ANNOUNCEMENTS 定義に対応する型（Issue #422）。
// ユーザー単位の行を持たない、運営からの全ユーザー向けお知らせ

export type Announcement = {
  id: string;
  message: string;
  created_at: string;
};
