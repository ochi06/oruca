import { User } from '../mocks/presence';
import { UserStatus } from '../constants/status';

export type PresenceLocation = {
  user_id: string;
  lat: number | null;
  lng: number | null;
};

export type PresenceMarker = {
  userId: string;
  latitude: number;
  longitude: number;
  displayName: string | null; // nullの場合、画面側では色つきドットのみ表示する
  iconUrl: string | null;
  status: UserStatus | null; // 承認済みでなければnull（名前・アイコンと同じ理由）
};

// Issue #120：エリアタップのポップアップ・フルリストで使う「そのエリアの在席者」1人分。
// buildPresenceMarkersと同じ可視性ルール（RLSで返ってきたusers＝承認済みの相手か自分自身
// のみ名前・アイコン・ステータスを見せる）を適用した結果を表す
export type AreaPresentUser = {
  userId: string;
  displayName: string | null;
  iconUrl: string | null;
  status: UserStatus | null;
};

// あるエリアに在席中のuserId一覧から、AreaPresentUser[]を組み立てる（Issue #120）。
// buildPresenceMarkersと同じvisibleUserIds（RLSで返ってきたusersから決めた
// 「名前を見せてよい相手」の集合）を受け取る形にして、可視性判定ロジックを重複させない
export function buildAreaPresentUsers(
  currentUserId: string,
  areaUserIds: string[],
  visibleUserIds: Set<string>,
  users: User[]
): AreaPresentUser[] {
  return areaUserIds.map((userId) => {
    const isVisible = userId === currentUserId || visibleUserIds.has(userId);
    const user = users.find((u) => u.id === userId);
    return {
      userId,
      displayName: isVisible ? user?.name ?? null : null,
      iconUrl: isVisible ? user?.icon_url ?? null : null,
      status: isVisible ? user?.status ?? null : null,
    };
  });
}

// Issue #58：マップ上に表示するマーカー情報を組み立てる。
// 「誰の名前・アイコンを見せてよいか」はvisibleUserIds（呼び出し側が
// resolveDisplayNameなどで判定した結果）で受け取る形にし、この関数自体は
// 可視性の判定ロジックを持たない（テスト・呼び出し側の判断基準の差し替えを
// しやすくするため）。自分自身は常に表示する
export function buildPresenceMarkers(
  currentUserId: string,
  presenceLocations: PresenceLocation[],
  visibleUserIds: Set<string>,
  users: User[]
): PresenceMarker[] {
  // 同じuser_idが複数のエリアに同時在席している場合（エリアが重なっている等）、
  // presenceLocationsに同じuser_idの行が複数含まれうる。地図上では1人1マーカーに
  // なるべきなので、最初の1件だけを採用して重複を防ぐ（Issue #127）
  const seenUserIds = new Set<string>();

  return presenceLocations
    .filter((location): location is PresenceLocation & { lat: number; lng: number } =>
      location.lat !== null && location.lng !== null
    )
    .filter((location) => {
      if (seenUserIds.has(location.user_id)) return false;
      seenUserIds.add(location.user_id);
      return true;
    })
    .map((location) => {
      const isVisible = location.user_id === currentUserId || visibleUserIds.has(location.user_id);
      const user = users.find((u) => u.id === location.user_id);
      return {
        userId: location.user_id,
        latitude: location.lat,
        longitude: location.lng,
        displayName: isVisible ? user?.name ?? null : null,
        iconUrl: isVisible ? user?.icon_url ?? null : null,
        status: isVisible ? user?.status ?? null : null,
      };
    });
}
