// docs/schema.md の GROUPS / GROUP_MEMBERS 定義に対応するモックデータ。
// バックエンド未接続の段階でUIを動かすための仮データ（app/mocks/presence.ts と同じ方針）。

import { CURRENT_USER_ID, mockUsers } from './presence';

export type GroupType = 'closed' | 'open';

export type Group = {
  id: string;
  owner_user_id: string;
  name: string;
  invite_code: string;
  is_public: boolean;
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
  created_at: string;
  updated_at: string;
};

const now = '2026-09-19T00:00:00.000Z';

// 自分が管理者（owner_user_id）のグループ。他人が作った公開グループを
// 検索できるよう（Issue #119）、自分が所属していない公開グループも追加している
export const mockGroups: Group[] = [
  {
    id: 'group-1',
    owner_user_id: CURRENT_USER_ID,
    name: 'バイト先',
    invite_code: 'ABCD12',
    is_public: false,
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
    is_public: true,
    type: 'closed',
    area_id: null,
    expires_at: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'group-3',
    owner_user_id: mockUsers[2].id, // 鈴木
    name: 'ボードゲーム会',
    invite_code: 'IJKL56',
    is_public: true,
    type: 'closed',
    area_id: null,
    expires_at: null,
    created_at: now,
    updated_at: now,
  },
];

// group-1: 自分（owner）・田中（承認済み）・鈴木（招待コードでの参加申請中）・
// 佐藤（友達からの招待で参加申請中）を再現
export const mockGroupMembers: GroupMember[] = [
  {
    id: 'member-owner',
    group_id: 'group-1',
    user_id: CURRENT_USER_ID,
    invited_by: null,
    status: 'approved',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-a',
    group_id: 'group-1',
    user_id: mockUsers[1].id, // 田中
    invited_by: null,
    status: 'approved',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-b',
    group_id: 'group-1',
    user_id: mockUsers[2].id, // 鈴木（招待コードでの自己申請、invited_byなし）
    invited_by: null,
    status: 'pending',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-c',
    group_id: 'group-1',
    user_id: mockUsers[3].id, // 佐藤（田中経由の招待）
    invited_by: mockUsers[1].id,
    status: 'pending',
    created_at: now,
    updated_at: now,
  },
  // group-2・group-3は自分が未所属の公開グループ（Issue #119の検索対象）。
  // オーナー自身の承認済みメンバー行のみ用意しておく
  {
    id: 'member-group2-owner',
    group_id: 'group-2',
    user_id: mockUsers[1].id,
    invited_by: null,
    status: 'approved',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'member-group3-owner',
    group_id: 'group-3',
    user_id: mockUsers[2].id,
    invited_by: null,
    status: 'approved',
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
    created_at: now,
    updated_at: now,
  },
];
