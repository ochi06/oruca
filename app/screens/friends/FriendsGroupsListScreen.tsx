import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { IconButton } from '../../components/IconButton';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
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
      <View style={[styles.segmentRow, { borderColor: colors.lightblue }]}>
        <Pressable
          style={[styles.segmentButton, segment === 'friends' && { backgroundColor: colors.blue }]}
          onPress={() => setSegment('friends')}
        >
          <Text
            style={[
              typography.body,
              { color: segment === 'friends' ? '#FFFFFF' : colors.text },
            ]}
          >
            友達
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, segment === 'groups' && { backgroundColor: colors.blue }]}
          onPress={() => setSegment('groups')}
        >
          <Text
            style={[
              typography.body,
              { color: segment === 'groups' ? '#FFFFFF' : colors.text },
            ]}
          >
            グループ
          </Text>
        </Pressable>
      </View>

      {segment === 'friends' ? <FriendsListScreen /> : <GroupsListScreen />}

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
  segmentRow: {
    flexDirection: 'row',
    margin: spacing.md,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
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
