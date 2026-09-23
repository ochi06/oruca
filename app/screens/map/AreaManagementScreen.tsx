import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { ensureSignedIn } from '../../lib/auth';
import { deleteArea, fetchOwnedAreas } from '../../lib/areas';
import { Area } from '../../mocks/areas';
import { MapStackParamList } from '../../navigation/types';

type LoadState = 'loading' | 'loaded' | 'error';

type Props = NativeStackScreenProps<MapStackParamList, 'AreaManagement'>;

export default function AreaManagementScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [state, setState] = useState<LoadState>('loading');
  const [areas, setAreas] = useState<Area[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Area | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setState('loading');
    ensureSignedIn()
      .then((userId) => fetchOwnedAreas(userId))
      .then((result) => {
        setAreas(result);
        setState('loaded');
      })
      .catch(() => {
        setState('error');
      });
  }

  useEffect(() => {
    load();
  }, []);

  // エリア編集画面から戻ってきた際に一覧を最新化する
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteArea(deleteTarget.id);
      setAreas((prev) => prev.filter((area) => area.id !== deleteTarget.id));
      showToast(`「${deleteTarget.name}」を削除しました`);
      setDeleteTarget(null);
    } catch {
      showToast('エリアの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  }

  if (state === 'loading') {
    return (
      <Screen style={styles.container}>
        <LoadingIndicator />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen style={styles.container}>
        <ErrorState message="エリア一覧の取得に失敗しました。" onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <IconButton
          name="close-outline"
          variant="secondary"
          accessibilityLabel="エリア管理を閉じる"
          style={styles.headerCloseButton}
          onPress={() => navigation.goBack()}
        />
        <Text style={[styles.title, { color: colors.text }]}>エリア管理</Text>
      </View>
      {areas.length === 0 ? (
        <EmptyState icon="map-outline" message="作成したエリアがまだありません" />
      ) : (
        areas.map((area) => (
          <ListItem
            key={area.id}
            title={area.name}
            subtitle={`半径 ${area.radius_m}m`}
            trailing={
              <View style={styles.rowActions}>
                <IconButton
                  name="pencil-outline"
                  variant="secondary"
                  accessibilityLabel={`${area.name}を編集`}
                  onPress={() => navigation.navigate('AreaEdit', { area })}
                  style={styles.rowActionButton}
                />
                <IconButton
                  name="trash-outline"
                  variant="secondary"
                  accessibilityLabel={`${area.name}を削除`}
                  onPress={() => setDeleteTarget(area)}
                  style={styles.rowActionButton}
                />
              </View>
            }
          />
        ))
      )}

      <Modal
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="エリアを削除しますか？"
      >
        <Text style={{ color: colors.text, marginBottom: spacing.md }}>
          「{deleteTarget?.name}」を削除すると、参加者の紐づけ・在席記録もあわせて削除されます。この操作は取り消せません。
        </Text>
        <View style={styles.modalButtonRow}>
          <Button
            label="キャンセル"
            variant="secondary"
            onPress={() => setDeleteTarget(null)}
            disabled={deleting}
            style={styles.modalButton}
          />
          <Button
            label={deleting ? '削除中…' : '削除する'}
            onPress={handleConfirmDelete}
            disabled={deleting}
            style={styles.modalButton}
          />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  title: {
    ...typography.heading,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerCloseButton: {
    marginBottom: spacing.md,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowActionButton: {
    padding: spacing.xs,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
});
