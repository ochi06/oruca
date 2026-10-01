import { supabase } from './supabase';
import { PresenceLog } from '../mocks/presence';

// Issue #178: アプリ起動時、自分の入室中（exited_atがnull）ログをDBから
// 読み込み、useGeofenceMonitorのlogsRefをhydrateするために使う
export async function fetchOpenPresenceLogs(userId: string): Promise<PresenceLog[]> {
  const { data, error } = await supabase
    .from('presence_logs')
    .select('*')
    .eq('user_id', userId)
    .is('exited_at', null);
  if (error) {
    throw error;
  }
  return (data ?? []) as PresenceLog[];
}
