import { supabase } from './supabase';
import { FriendAreaLink } from '../mocks/presence';
import { AreaSchedule, AreaScheduleOverride } from '../utils/schedules';

// 指定エリアのAREA_SCHEDULESを取得する（Issue #159）。RLS
// （supabase/migrations/20261001130000_area_schedules.sql）により、
// 自分の行＋このエリアでFRIEND_AREA_LINKSが承認済みの相手の行のみ返る
export async function fetchAreaSchedules(areaId: string): Promise<AreaSchedule[]> {
  const { data, error } = await supabase.from('area_schedules').select('*').eq('area_id', areaId);
  if (error) {
    throw error;
  }
  return (data ?? []) as AreaSchedule[];
}

// 指定エリア・日付のAREA_SCHEDULE_OVERRIDESを取得する（Issue #159）。
// RLSはAREA_SCHEDULESと同じ方針
export async function fetchAreaScheduleOverrides(
  areaId: string,
  date: string
): Promise<AreaScheduleOverride[]> {
  const { data, error } = await supabase
    .from('area_schedule_overrides')
    .select('*')
    .eq('area_id', areaId)
    .eq('date', date);
  if (error) {
    throw error;
  }
  return (data ?? []) as AreaScheduleOverride[];
}

// 友達一覧・詳細画面のステータスアイコン表示用（Issue #274）。特定のエリアに
// 絞らず、自分が閲覧できる全件を取得する。RLSが「自分の行＋そのエリアで
// 承認済みFRIEND_AREA_LINKSの相手の行」のみを返すため、area_idで絞り込まなくても
// 可視性は保たれる
export async function fetchAllVisibleAreaSchedules(): Promise<AreaSchedule[]> {
  const { data, error } = await supabase.from('area_schedules').select('*');
  if (error) {
    throw error;
  }
  return (data ?? []) as AreaSchedule[];
}

export async function fetchAllVisibleAreaScheduleOverrides(date: string): Promise<AreaScheduleOverride[]> {
  const { data, error } = await supabase.from('area_schedule_overrides').select('*').eq('date', date);
  if (error) {
    throw error;
  }
  return (data ?? []) as AreaScheduleOverride[];
}

// このエリアで名前つき表示に合意している（承認済み）FRIEND_AREA_LINKSを取得する。
// resolveFriendSchedule（app/utils/schedules.ts）の可視性判定に渡す
export async function fetchFriendAreaLinks(areaId: string): Promise<FriendAreaLink[]> {
  const { data, error } = await supabase
    .from('friend_area_links')
    .select('*')
    .eq('area_id', areaId)
    .eq('status', 'approved');
  if (error) {
    throw error;
  }
  return (data ?? []) as FriendAreaLink[];
}

// 自分の基本滞在予定を保存する（US-011）。ユーザー×エリアごとに1件
// （unique(user_id, area_id)）のため、既存行があれば更新する
export async function upsertMySchedule(
  userId: string,
  areaId: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from('area_schedules')
    .upsert({ user_id: userId, area_id: areaId, note }, { onConflict: 'user_id,area_id' });
  if (error) {
    throw error;
  }
}

// 自分の当日上書き予定を保存する（US-011）。ユーザー×エリア×日付ごとに1件
// （unique(user_id, area_id, date)）のため、既存行があれば更新する
export async function upsertMyScheduleOverride(
  userId: string,
  areaId: string,
  date: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from('area_schedule_overrides')
    .upsert(
      { user_id: userId, area_id: areaId, date, note },
      { onConflict: 'user_id,area_id,date' }
    );
  if (error) {
    throw error;
  }
}
