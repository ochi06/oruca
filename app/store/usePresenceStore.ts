import { create } from 'zustand';

import { fetchPresenceMapData, PresenceMapData } from '../lib/presence';
import { supabase } from '../lib/supabase';

type Status = 'idle' | 'loading' | 'loaded' | 'error';

type PresenceState = PresenceMapData & {
  status: Status;
  // silent: trueの場合は既存表示を保ったまま裏で更新する（Realtime受信時用）。
  // false/省略時は初回取得・画面フォーカス時の明示的な再取得で、ローディング表示を伴う
  load: (opts?: { silent?: boolean }) => Promise<void>;
};

// 購読中のチャンネルとその対象エリアID集合。エリア集合が変わらない限り
// 購読を張り直さない（モジュールスコープで保持し、ストアを使う画面の
// マウント/アンマウントに関わらず常に最新の購読を維持する）
let channel: ReturnType<typeof supabase.channel> | null = null;
let subscribedAreaKey: string | null = null;

function subscribeToPresenceChanges(areaIds: string[], onChange: () => void): void {
  const key = areaIds.slice().sort().join(',');
  if (key === subscribedAreaKey) return;
  subscribedAreaKey = key;

  channel?.unsubscribe();
  channel = null;
  if (areaIds.length === 0) return;

  // Issue #308: presence_logsの入退室・位置更新をRealtimeで購読し、マップ・
  // 在席人数・在席者一覧を自動で最新化する（useGeofenceMonitorのuser_areas購読と同じ方針）
  channel = supabase
    .channel(`presence_logs:areas:${key}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'presence_logs', filter: `area_id=in.(${areaIds.join(',')})` },
      onChange
    )
    .subscribe();
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  status: 'idle',
  currentUserId: '',
  areas: [],
  markers: [],
  areaPresence: {},
  markersByArea: {},

  load: async (opts) => {
    if (!opts?.silent) set({ status: 'loading' });
    try {
      const result = await fetchPresenceMapData();
      set({ ...result, status: 'loaded' });
      subscribeToPresenceChanges(result.areas.map((area) => area.id), () => {
        get().load({ silent: true });
      });
    } catch {
      if (!opts?.silent) set({ status: 'error' });
    }
  },
}));
