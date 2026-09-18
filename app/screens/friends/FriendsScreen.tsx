import { useState } from 'react';

import FriendsListScreen from './FriendsListScreen';
import AddFriendScreen from './AddFriendScreen';
import QrScanScreen from './QrScanScreen';

// docs/architecture.md「友達」タブのStack構成（友達一覧 → OTP入力 or QR読み取り）
// を、react-navigation導入前の簡易な内部状態で再現する。
type Route = 'list' | 'add' | 'scan';

export default function FriendsScreen() {
  const [route, setRoute] = useState<Route>('list');

  if (route === 'add') {
    return <AddFriendScreen onBack={() => setRoute('list')} onScanQr={() => setRoute('scan')} />;
  }
  if (route === 'scan') {
    return (
      <QrScanScreen onBack={() => setRoute('add')} onDone={() => setRoute('list')} />
    );
  }
  return <FriendsListScreen onAddFriend={() => setRoute('add')} />;
}
