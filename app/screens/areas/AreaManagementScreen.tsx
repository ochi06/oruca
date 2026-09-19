import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  MapMarker,
  MapPressEvent,
  MapStyleElement,
  MarkerDragStartEndEvent,
} from 'react-native-maps';
import Slider from '@react-native-community/slider';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { IconButton } from '../../components/IconButton';
import { Input } from '../../components/Input';
import { ListItem } from '../../components/ListItem';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { Modal } from '../../components/Modal';
import { Screen } from '../../components/Screen';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { darkMapStyle } from '../../constants/mapStyle';
import { RADIUS_MIN_M, RADIUS_MAX_M } from '../../constants/area';
import { ensureSignedIn } from '../../lib/auth';
import { deleteArea, fetchOwnedAreas, updateArea } from '../../lib/areas';
import { Area } from '../../mocks/areas';
import {
  LatLng,
  bearingDegrees,
  destinationPoint,
  distanceInMeters,
} from '../../utils/geo';

const INITIAL_HANDLE_BEARING_DEG = 90; // 初期状態のみ真東
const EMPTY_MAP_STYLE: MapStyleElement[] = [];

function clampRadius(m: number): number {
  return Math.round(Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, m)));
}

type LoadState = 'loading' | 'loaded' | 'error';
type Route = { name: 'list' } | { name: 'edit'; area: Area };

function AreaEditView({
  area,
  onSaved,
  onCancel,
}: {
  area: Area;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState(area.name);
  const [pin, setPin] = useState<LatLng>({
    latitude: area.center_lat,
    longitude: area.center_lng,
  });
  const [radiusM, setRadiusM] = useState(area.radius_m);
  const [handleBearingDeg, setHandleBearingDeg] = useState(INITIAL_HANDLE_BEARING_DEG);
  const [saving, setSaving] = useState(false);
  const handleMarkerRef = useRef<MapMarker>(null);

  const handleMapPress = (event: MapPressEvent) => {
    setPin(event.nativeEvent.coordinate);
    setHandleBearingDeg(INITIAL_HANDLE_BEARING_DEG);
  };

  const handleHandleDrag = (event: MarkerDragStartEndEvent) => {
    const draggedTo = event.nativeEvent.coordinate;
    const clampedRadius = clampRadius(distanceInMeters(pin, draggedTo));
    const bearing = bearingDegrees(pin, draggedTo);

    setRadiusM(clampedRadius);
    setHandleBearingDeg(bearing);

    // ドラッグ中はネイティブ側が指の位置を優先してしまうため、
    // クランプ後の正しい位置に強制的に戻す
    handleMarkerRef.current?.setCoordinates(destinationPoint(pin, clampedRadius, bearing));
  };

  const handlePosition = destinationPoint(pin, radiusM, handleBearingDeg);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('エリア名を入力してください');
      return;
    }
    setSaving(true);
    try {
      await updateArea(area.id, {
        name: trimmedName,
        center_lat: pin.latitude,
        center_lng: pin.longitude,
        radius_m: radiusM,
      });
      showToast(`「${trimmedName}」を更新しました`);
      onSaved();
    } catch {
      showToast('エリアの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={styles.container} avoidKeyboard>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: pin.latitude,
          longitude: pin.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
        customMapStyle={isDark ? darkMapStyle : EMPTY_MAP_STYLE}
      >
        <Marker coordinate={pin} pinColor={colors.navy} />
        <Circle
          center={pin}
          radius={radiusM}
          strokeColor={colors.blue}
          fillColor={`${colors.blue}33`}
        />
        <Marker
          ref={handleMarkerRef}
          coordinate={handlePosition}
          draggable
          onDrag={handleHandleDrag}
          onDragEnd={handleHandleDrag}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.handleDot, { backgroundColor: colors.sand }]} />
        </Marker>
      </MapView>
      <IconButton
        name="close-outline"
        variant="secondary"
        accessibilityLabel="編集をやめる"
        style={styles.closeButton}
        onPress={onCancel}
        disabled={saving}
      />
      <View style={[styles.editPanel, { backgroundColor: colors.surface }]}>
        <Input value={name} onChangeText={setName} placeholder="エリア名（例：部室）" />
        <Text style={{ color: colors.text }}>半径: {Math.round(radiusM)}m</Text>
        <Slider
          minimumValue={RADIUS_MIN_M}
          maximumValue={RADIUS_MAX_M}
          step={1}
          value={radiusM}
          onValueChange={setRadiusM}
        />
        <Button label={saving ? '保存中…' : '保存する'} onPress={handleSave} disabled={saving} />
      </View>
    </Screen>
  );
}

function AreaListView({
  onEdit,
  onClose,
}: {
  onEdit: (area: Area) => void;
  onClose?: () => void;
}) {
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
        {onClose && (
          <IconButton
            name="close-outline"
            variant="secondary"
            accessibilityLabel="エリア管理を閉じる"
            style={styles.headerCloseButton}
            onPress={onClose}
          />
        )}
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
                  onPress={() => onEdit(area)}
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

type Props = {
  onClose?: () => void;
};

export default function AreaManagementScreen({ onClose }: Props) {
  const [route, setRoute] = useState<Route>({ name: 'list' });

  if (route.name === 'edit') {
    return (
      <AreaEditView
        area={route.area}
        onSaved={() => setRoute({ name: 'list' })}
        onCancel={() => setRoute({ name: 'list' })}
      />
    );
  }

  return <AreaListView onEdit={(area) => setRoute({ name: 'edit', area })} onClose={onClose} />;
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
  map: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    left: 16,
  },
  handleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  editPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
});
