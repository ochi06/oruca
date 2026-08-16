// docs/schema.md の AREAS / USER_AREAS 定義に対応するモックデータ。
// バックエンド未接続の段階でUIを動かすための仮データであり、実DBの型とは
// 将来的にSupabaseのスキーマ定義（生成型）で置き換える想定。

export type Area = {
  id: string;
  owner_user_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type UserArea = {
  id: string;
  user_id: string;
  area_id: string;
  created_at: string;
};

const now = '2026-08-15T00:00:00.000Z';

export const mockAreas: Area[] = [
  {
    id: 'area-1',
    owner_user_id: 'user-1',
    name: '部室',
    center_lat: 34.7025,
    center_lng: 135.4959,
    radius_m: 30,
    is_public: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'area-2',
    owner_user_id: 'user-1',
    name: 'オフィス',
    center_lat: 34.6851,
    center_lng: 135.5259,
    radius_m: 50,
    is_public: false,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'area-3',
    owner_user_id: 'user-2',
    name: '学食',
    center_lat: 34.7042,
    center_lng: 135.4938,
    radius_m: 40,
    is_public: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'area-4',
    owner_user_id: 'user-2',
    name: '図書館',
    center_lat: 34.7008,
    center_lng: 135.4977,
    radius_m: 60,
    is_public: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'area-5',
    owner_user_id: 'user-3',
    name: '自宅',
    center_lat: 34.6912,
    center_lng: 135.5102,
    radius_m: 20,
    is_public: false,
    created_at: now,
    updated_at: now,
  },
];

export const mockUserAreas: UserArea[] = [
  {
    id: 'user-area-1',
    user_id: 'user-1',
    area_id: 'area-1',
    created_at: now,
  },
];
