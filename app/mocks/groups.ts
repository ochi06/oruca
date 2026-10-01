// docs/schema.md の GROUPS / GROUP_MEMBERS 定義に対応するモックデータ。
// バックエンド未接続の段階でUIを動かすための仮データ（app/mocks/presence.ts と同じ方針）。

import { CURRENT_USER_ID, mockUsers } from './presence';

export type GroupType = 'closed' | 'open';

export type Group = {
  id: string;
  owner_user_id: string;
  name: string;
  invite_code: string;
  type: GroupType;
  area_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupMemberStatus = 'pending' | 'approved' | 'rejected';

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  invited_by: string | null;
  status: GroupMemberStatus;
  // そのグループ内限定でUSERS.name/icon_urlを上書きする任意項目（Issue #150）。
  // 未設定（null）の場合はUSERS側にフォールバックする
  display_name: string | null;
  display_icon_url: string | null;
  created_at: string;
  updated_at: string;
};

const now = '2026-09-19T00:00:00.000Z';

// 自分が管理者（owner_user_id）のグループ。group-2は自分宛の招待デモ用に
// 田中が所有するグループとして残している
export const mockGroups: Group[] = [
  {
    id: 'group-1',
    owner_user_id: CURRENT_USER_ID,
    name: 'バイト先',
    invite_code: 'ABCD12',
    type: 'closed',
    area_id: null,
    expires_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'group-2',
    owner_user_id: mockUsers[1].id, // 田中
    name: '写真部',
    invite_code: 'EFGH34',
    type: 'closed',
    area_id: null,
    expires_at: null,
    created_at: now,
    updated_at: now,
  },
];

// group-1: 自分（owner）・田中（承認済み）・鈴木（自分からの招待で参加申請中）・
// 佐藤（田中からの招待で参加申請中）を再現
export const mockGroupMembers: GroupMember[] = [
  {
    id: 'member-owner',
    group_id: 'group-1',
    user_id: CURRENT_USER_ID,
    invited_by: null,
    status: 'approved',
    display_name: null,
    display_icon_url: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-a',
    group_id: 'group-1',
    user_id: mockUsers[1].id, // 田中
    invited_by: null,
    status: 'approved',
    display_name: null,
    display_icon_url: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-b',
    group_id: 'group-1',
    user_id: mockUsers[2].id, // 鈴木（自分からの招待）
    invited_by: CURRENT_USER_ID,
    status: 'pending',
    display_name: null,
    display_icon_url: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-c',
    group_id: 'group-1',
    user_id: mockUsers[3].id, // 佐藤（田中経由の招待）
    invited_by: mockUsers[1].id,
    status: 'pending',
    display_name: null,
    display_icon_url: null,
    created_at: now,
    updated_at: now,
  },
  // group-2は自分が未所属のグループ。オーナー自身の承認済みメンバー行
  {
    id: 'member-group2-owner',
    group_id: 'group-2',
    user_id: mockUsers[1].id,
    invited_by: null,
    status: 'approved',
    display_name: null,
    display_icon_url: null,
    created_at: now,
    updated_at: now,
  },
  // 自分宛の招待（Issue #126の通知ボックスのgroup_invite表示デモ用）。
  // 田中（group-2のオーナー）から自分への招待
  {
    id: 'member-invite-demo',
    group_id: 'group-2',
    user_id: CURRENT_USER_ID,
    invited_by: mockUsers[1].id,
    status: 'pending',
    display_name: null,
    display_icon_url: null,
    created_at: now,
    updated_at: now,
  },
];
