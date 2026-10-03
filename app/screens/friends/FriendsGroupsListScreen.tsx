import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { FriendsGroupsStackParamList } from '../../navigation/types';
import FriendsListScreen from './FriendsListScreen';
import GroupsListScreen from '../groups/GroupsListScreen';

type Segment = 'friends' | 'groups';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'FriendsGroupsList'>;

// 友達・グループタブの初期画面（docs/architecture.md「3. 画面構成・ナビゲーション」参照）。
// セグメント切替で友達一覧/グループ一覧を出し分け、フローティングボタンから
// 友達追加・グループ作成・グループ参加・コードを読み取る/入力するの4択に遷移する
// （Issue #208で友達追加QR/グループ参加QR・コード入力をRedeemCodeScreenに統合）
export default function FriendsGroupsListScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const [segment, setSegment] = useState<Segment>(route.params?.initialSegment ?? 'friends');
  const [menuOpen, setMenuOpen] = useState(false);
  // 検索欄はセグメント切替の外側に1つだけ配置し、タップで展開する（Issue #284、
  // Issue #251でセグメントごとに個別実装していたものをここに引き上げた）。
  // 検索対象は常に「現在選択中のセグメントの一覧」のまま（友達・グループ横断はしない）
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  function handleCloseSearch() {
    setSearchOpen(false);
    setSearchQuery('');
  }

  // マップ画面の戻る矢印から、タップ時点のセグメント（友達/グループ）で戻ってこられるように
  // （Issue #261）。この画面自体はスタック内で使い回されるため、useStateの初期値だけでは
  // 2回目以降のnavigate時に反映されない。レンダー中にstateを更新する公式パターン
  // （https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes）
  // を使い、useEffectでの同期は避ける
  const [prevInitialSegment, setPrevInitialSegment] = useState(route.params?.initialSegment);
  if (route.params?.initialSegment && route.params.initialSegment !== prevInitialSegment) {
    setPrevInitialSegment(route.params.initialSegment);
    setSegment(route.params.initialSegment);
  }

  function navigateFromMenu(screen: 'AddFriend' | 'GroupCreate' | 'GroupJoin' | 'RedeemCode') {
    setMenuOpen(false);
    navigation.navigate(screen);
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <SegmentedControl
          style={styles.segmentRow}
          options={[
            { value: 'friends', label: '友達' },
            { value: 'groups', label: 'グループ' },
          ]}
          value={segment}
          onChange={setSegment}
        />
        {!searchOpen && (
          <IconButton
            name="search-outline"
            variant="secondary"
            accessibilityLabel="検索"
            onPress={() => setSearchOpen(true)}
          />
        )}
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <Input
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="名前で検索"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <IconButton
            name="close-outline"
            variant="secondary"
            size={20}
            accessibilityLabel="検索を閉じる"
            onPress={handleCloseSearch}
          />
        </View>
      )}

      {segment === 'friends' ? (
        <FriendsListScreen searchQuery={searchQuery} />
      ) : (
        <GroupsListScreen searchQuery={searchQuery} />
      )}

      <IconButton
        name="add-outline"
        accessibilityLabel="友達追加・グループ作成など"
        style={styles.fab}
        onPress={() => setMenuOpen(true)}
      />

      <Modal visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <View style={styles.menu}>
          <Pressable style={styles.menuItem} onPress={() => navigateFromMenu('AddFriend')}>
            <Text style={[typography.body, { color: colors.text }]}>友達追加</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => navigateFromMenu('GroupCreate')}>
            <Text style={[typography.body, { color: colors.text }]}>グループ作成</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => navigateFromMenu('GroupJoin')}>
            <Text style={[typography.body, { color: colors.text }]}>グループ参加（招待の承諾）</Text>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => navigateFromMenu('RedeemCode')}>
            <Text style={[typography.body, { color: colors.text }]}>コードを読み取る・入力する</Text>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
  },
  segmentRow: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
  menu: {
    gap: spacing.sm,
  },
  menuItem: {
    paddingVertical: spacing.sm,
  },
});
