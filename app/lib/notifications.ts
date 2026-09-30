// Issue #160: NOTIFICATIONSの実Supabaseクエリ。lib/areas.ts・lib/groups.tsと
// 同じ方針で、supabaseクライアントを直接叩く薄い関数群にする（RLSで
// user_id = auth.uid()の行のみに絞られるため、ここでは絞り込みを行わない）。
//
// INSERTはクライアントから行わない（service role側のEdge Functionのみが作成する、
// supabase/functions/send-entry-notifications/index.ts参照）ため、ここには無い。

import { supabase } from './supabase';
import { Notification } from '../mocks/notifications';

export async function fetchMyNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) throw error;
}
