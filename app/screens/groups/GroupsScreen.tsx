import { useState } from 'react';

import GroupsListScreen from './GroupsListScreen';
import GroupDetailScreen from './GroupDetailScreen';

// FriendsScreenと同じ方針（react-navigation導入前の簡易な内部状態でのStack構成）
type Route = { name: 'list' } | { name: 'detail'; groupId: string };

export default function GroupsScreen() {
  const [route, setRoute] = useState<Route>({ name: 'list' });

  if (route.name === 'detail') {
    return <GroupDetailScreen groupId={route.groupId} onBack={() => setRoute({ name: 'list' })} />;
  }
  return <GroupsListScreen onSelectGroup={(groupId) => setRoute({ name: 'detail', groupId })} />;
}
