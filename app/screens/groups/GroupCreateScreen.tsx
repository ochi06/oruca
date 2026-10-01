import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Input } from '../../components/Input';
import { ListItem } from '../../components/ListItem';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { GROUP_NAME_MAX_LENGTH } from '../../constants/group';
import { ensureSignedIn } from '../../lib/auth';
import { useGroupStore } from '../../store/useGroupStore';
import { Area } from '../../mocks/areas';
import { GroupType } from '../../mocks/groups';
import { fetchOwnedAreas } from '../../lib/areas';
import { validateGroupTypeAndArea } from '../../utils/groupOpenType';
import { FriendsGroupsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<FriendsGroupsStackParamList, 'GroupCreate'>;

// グループ作成画面（Issue #116、Issue #148でtype/area_id選択を追加）。
// GROUPS/GROUP_MEMBERSへの実insertはuseGroupStore経由で行う
export default function GroupCreateScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const createGroup = useGroupStore((state) => state.createGroup);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [type, setType] = useState<GroupType>('closed');
  const [ownedAreas, setOwnedAreas] = useState<Area[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  function loadUser() {
    setAuthError(false);
    ensureSignedIn()
      .then((signedInUserId) => {
        setUserId(signedInUserId);
        fetchOwnedAreas(signedInUserId)
          .then(setOwnedAreas)
          .catch(() => setOwnedAreas([]));
      })
      .catch(() => setAuthError(true));
  }

  useEffect(() => {
    loadUser();
  }, []);

  function handleSelectType(nextType: GroupType) {
    setType(nextType);
    if (nextType === 'closed') {
      setSelectedAreaId(null);
    }
  }

  async function handleCreate() {
    if (!userId) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('グループ名を入力してください');
      return;
    }
    if (trimmedName.length > GROUP_NAME_MAX_LENGTH) {
      showToast(`グループ名は${GROUP_NAME_MAX_LENGTH}文字以内で入力してください`);
      return;
    }
    const validationError = validateGroupTypeAndArea(type, selectedAreaId);
    if (validationError === 'area_required') {
      showToast('オープングループはイベント会場（エリア）を選択してください');
      return;
    }

    setCreating(true);
    try {
      const newGroup = await createGroup(trimmedName, userId, isPublic, type, selectedAreaId);
      showToast(`「${newGroup.name}」を作成しました`);
      // 一覧に戻らず、作成したグループの詳細画面へそのまま遷移する
      navigation.replace('GroupDetail', { groupId: newGroup.id });
    } catch {
      showToast('グループの作成に失敗しました');
      setCreating(false);
    }
  }

  if (authError) {
    return (
      <Screen style={styles.container}>
        <ErrorState message="ログイン状態を確認できませんでした。" onRetry={loadUser} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <Text style={[styles.title, { color: colors.text }]}>グループ作成</Text>
      <Input
        value={name}
        onChangeText={setName}
        placeholder="グループ名（例：バイト先）"
        maxLength={GROUP_NAME_MAX_LENGTH}
        editable={!creating}
        autoFocus
      />
      <View style={styles.publicRow}>
        <Text style={{ color: colors.text }}>公開グループにする（検索して参加申請できる）</Text>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          disabled={creating}
          trackColor={{ true: colors.blue, false: colors.lightblue }}
          accessibilityLabel="公開グループにする"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSub }]}>種別</Text>
      <View style={styles.typeRow}>
        <Button
          label="クローズ（友達を招待）"
          variant={type === 'closed' ? 'primary' : 'secondary'}
          onPress={() => handleSelectType('closed')}
          disabled={creating}
          style={styles.typeButton}
        />
        <Button
          label="オープン（QRで誰でも参加）"
          variant={type === 'open' ? 'primary' : 'secondary'}
          onPress={() => handleSelectType('open')}
          disabled={creating}
          style={styles.typeButton}
        />
      </View>

      {type === 'open' && (
        <View style={styles.areaSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSub }]}>イベント会場（エリア）</Text>
          {ownedAreas.length === 0 ? (
            <EmptyState icon="location-outline" message="先にエリアを登録してください" />
          ) : (
            ownedAreas.map((area) => (
              <ListItem
                key={area.id}
                title={area.name}
                onPress={() => setSelectedAreaId(area.id)}
                trailing={selectedAreaId === area.id ? <Text style={{ color: colors.blue }}>選択中</Text> : undefined}
              />
            ))
          )}
        </View>
      )}

      <Button
        label={creating ? '作成中…' : '作成する'}
        onPress={handleCreate}
        disabled={creating || !userId}
        style={styles.createButton}
      />
      <Button label="戻る" variant="secondary" onPress={() => navigation.goBack()} disabled={creating} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.lg,
  },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
  },
  areaSection: {
    marginTop: spacing.sm,
  },
  createButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
