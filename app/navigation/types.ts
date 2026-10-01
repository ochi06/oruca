// react-navigation本導入（Issue #114）に伴う各Stack/Tabのparam list。
// 画面追加時はここに型を足してから、対応するNavigatorに登録する。

import type { NavigatorScreenParams } from '@react-navigation/native';
import { Area } from '../mocks/areas';
import { AreaPresentUser } from '../utils/presenceMarkers';
import { Region } from '../utils/mapRegion';

export type MapStackParamList = {
  Map: undefined;
  // マップ画面が既に取得済みのそのエリアの在席者一覧をそのまま渡す
  // （Issue #120。再フェッチしないためRealtimeでの自動更新はされない点に注意）
  PresenceList: { areaName: string; users: AreaPresentUser[] };
  // マップ画面で見ていた表示範囲をそのまま初期表示に引き継ぐ（Issue #186）。
  // 省略時（参加エリアが無い状態からのEmptyState経由等）は既存のフォールバック座標を使う
  AreaRegistration: { initialRegion?: Region } | undefined;
  AreaManagement: undefined;
  AreaEdit: { area: Area };
};

export type FriendsGroupsStackParamList = {
  FriendsGroupsList: undefined;
  FriendDetail: { friendId: string };
  GroupDetail: { groupId: string };
  AddFriend: undefined;
  QrScan: undefined;
  GroupCreate: undefined;
  GroupJoin: undefined;
  GroupJoinRequest: undefined;
  GroupQrScan: undefined;
};

export type SettingsStackParamList = {
  ProfileTop: undefined;
  Settings: undefined;
  NotificationBox: undefined;
};

export type RootTabParamList = {
  // ネストしたStack Navigatorの画面へタブをまたいで直接遷移できるように
  // （Issue #120フォローアップ：マップのマーカータップ→友達詳細）、
  // 各タブの中身をNavigatorScreenParamsとして持たせる
  MapTab: NavigatorScreenParams<MapStackParamList>;
  FriendsGroupsTab: NavigatorScreenParams<FriendsGroupsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};
