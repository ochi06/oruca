// docs/schema.md の NOTIFICATIONS 定義に対応するモックデータ・型。
// バックエンド未接続の段階でUIを動かすための仮データ（他のmocksと同じ方針）。

export type NotificationType =
  | 'entry'
  | 'want_to_meet'
  | 'group_invite'
  | 'friend_added'
  | 'area_link_proposed';

export type Notification = {
  id: string;
  user_id: string; // 受信者
  type: NotificationType;
  related_user_id: string | null; // 入室した友達／招待者／提案者など（typeに応じて使う）
  area_id: string | null; // area_link_proposed用
  group_member_id: string | null; // group_invite用（GROUP_MEMBERSの行）
  is_read: boolean;
  created_at: string;
};
