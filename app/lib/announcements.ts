import { supabase } from './supabase';
import { Announcement } from '../mocks/announcements';

// 運営からのお知らせ一覧を取得する（Issue #422）。RLSの
// "announcements are readable by anyone"により、未ログイン状態でなければ
// 全件読める（投稿はSupabaseダッシュボードからdeveloperが直接INSERTする運用）
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as Announcement[];
}
