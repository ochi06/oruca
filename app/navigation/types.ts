// react-navigation本導入（Issue #114）に伴う各Stack/Tabのparam list。
// 画面追加時はここに型を足してから、対応するNavigatorに登録する。

import type { NavigatorScreenParams } from '@react-navigation/native';
import { Area } from '../mocks/areas';
import { Region } from '../utils/mapRegion';

export type MapStackParamList = {
  // 友達・グループ一覧の行タップからの絞り込み遷移（Issue #261）。
  // originを渡すと左上に戻る矢印を出し、遷移元の一覧（FriendsGroupsList）に戻れるようにする
  Map: { filterAreaId?: string; origin?: 'friends' | 'groups' } | undefined;
  // 在席者一覧はusePresenceStoreから取得するため、areaIdのみ渡す
  // （Issue #308：Realtime購読の結果がこの画面にも反映されるようにするため）
  PresenceList: { areaName: string; areaId: string };
  // マップ画面で見ていた表示範囲をそのまま初期表示に引き継ぐ（Issue #186）。
  // 省略時（参加エリアが無い状態からのEmptyState経由等）は既存のフォールバック座標を使う
  AreaRegistration: { initialRegion?: Region } | undefined;
  AreaManagement: undefined;
  AreaEdit: { area: Area };
};

export type FriendsGroupsStackParamList = {
  // マップ画面の戻る矢印から戻ってきた際、遷移前のセグメント（友達/グループ）を
  // 復元できるようにする（Issue #261）
  FriendsGroupsList: { initialSegment?: 'friends' | 'groups' } | undefined;
  FriendDetail: { friendId: string };
  GroupDetail: { groupId: string };
  AddFriend: undefined;
  GroupCreate: undefined;
  GroupJoin: undefined;
  // Issue #208: 友達追加のQRスキャン/手入力・グループ参加のQRスキャン/
  // 招待コード手入力を1画面に統合。カメラの有無（Web/ネイティブ）は画面内で
  // Platform.OS分岐する
  RedeemCode: undefined;
};

export type SettingsStackParamList = {
  // Issue #356：プロフィール編集（アイコン・名前・ステータス）と詳細設定
  // （テーマ・入室通知・匿名モード等）を1画面に統合した（Issue #176の方針転換）。
  // 歯車アイコン経由の別画面（旧Settings）は廃止
  ProfileTop: undefined;
  NotificationBox: undefined;
  // Issue #168: 匿名セッション中のみ設定画面から遷移する本登録導線
  AccountUpgrade: undefined;
  // Issue #244 (US-011): 自分の滞在予定を編集する導線。まず監視中の全エリア
  // （user_areas、所有エリアに限らない）から対象を選び、ScheduleEditFormを表示する
  ScheduleAreaList: undefined;
  ScheduleEdit: { areaId: string; areaName: string };
};

export type RootTabParamList = {
  // ネストしたStack Navigatorの画面へタブをまたいで直接遷移できるように
  // （Issue #120フォローアップ：マップのマーカータップ→友達詳細）、
  // 各タブの中身をNavigatorScreenParamsとして持たせる
  MapTab: NavigatorScreenParams<MapStackParamList>;
  FriendsGroupsTab: NavigatorScreenParams<FriendsGroupsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};
