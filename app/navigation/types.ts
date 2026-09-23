// react-navigation本導入（Issue #114）に伴う各Stack/Tabのparam list。
// 画面追加時はここに型を足してから、対応するNavigatorに登録する。

import { Area } from '../mocks/areas';

export type MapStackParamList = {
  Map: undefined;
  PresenceList: undefined;
  AreaRegistration: undefined;
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
};

export type SettingsStackParamList = {
  SettingsTop: undefined;
  NotificationBox: undefined;
};

export type RootTabParamList = {
  MapTab: undefined;
  FriendsGroupsTab: undefined;
  SettingsTab: undefined;
};
