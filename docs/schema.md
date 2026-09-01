# DB設計（Must User Story対応・正式版）

以下が本開発（`app/`）で使用する正式なスキーマ。

## ER図

```mermaid
erDiagram
  USERS ||--o{ AREAS : owns
  USERS ||--o{ USER_AREAS : monitors
  AREAS ||--o{ USER_AREAS : monitored_by
  USERS ||--o{ PRESENCE_LOGS : records
  AREAS ||--o{ PRESENCE_LOGS : recorded_in
  USERS ||--o{ FRIENDSHIPS : "user_id (自分)"
  USERS ||--o{ FRIENDSHIPS : "friend_id (相手)"
  USERS ||--o{ FRIEND_AREA_LINKS : "initiator_id (提案者)"
  USERS ||--o{ FRIEND_AREA_LINKS : "friend_id (相手)"
  AREAS ||--o{ FRIEND_AREA_LINKS : shown_in
  USERS ||--o{ OTP_CODES : generates

  USERS {
    uuid id PK
    string name
    string icon_url
    timestamp created_at
    timestamp updated_at
  }
  AREAS {
    uuid id PK
    uuid owner_user_id FK
    string name
    float8 center_lat
    float8 center_lng
    int radius_m
    boolean is_public
    timestamp created_at
    timestamp updated_at
  }
  USER_AREAS {
    uuid id PK
    uuid user_id FK
    uuid area_id FK
    timestamp created_at
  }
  FRIENDSHIPS {
    uuid id PK
    uuid user_id FK
    uuid friend_id FK
    boolean notify_enabled
    boolean muted
    string status
    timestamp created_at
    timestamp updated_at
  }
  FRIEND_AREA_LINKS {
    uuid id PK
    uuid initiator_id FK
    uuid friend_id FK
    uuid area_id FK
    string status
    timestamp created_at
    timestamp updated_at
  }
  OTP_CODES {
    uuid id PK
    uuid user_id FK
    string code
    timestamp expires_at
    timestamp created_at
  }
  PRESENCE_LOGS {
    uuid id PK
    uuid user_id FK
    uuid area_id FK
    timestamp entered_at
    timestamp exited_at
    double lat
    double lng
  }
```

## 各テーブルの役割

- **USERS**：利用者本体
- **AREAS**：US-018で登録するエリア（円形：中心座標＋半径）。`center_lat`/
  `center_lng`は小数点以下6桁に丸める（約11cm精度、地図SDKの生の値をそのまま
  保存しない）。`radius_m`は10〜200mの範囲（下限はGPS精度によるブレを考慮、
  上限はオフィス・部室規模を想定。学校のような広い敷地は複数エリアに分けて
  登録する前提。値は最も近い整数に丸める）
- **USER_AREAS**：個人が「このエリアを監視する」ための登録。承認不要
- **FRIENDSHIPS**：友達関係。片方向（user_id→friend_id）で1関係につき2行。
  `notify_enabled`（US-007）・`muted`（US-008）を関係ごとに個別管理できる
- **FRIEND_AREA_LINKS**：特定の友達との間で「このエリアでは名前つきで
  見せ合う」という合意。提案（pending）→承認（approved）の二段階
- **OTP_CODES**：US-005のワンタイムパスワード（60秒で失効）
- **PRESENCE_LOGS**：入退室記録。`exited_at`がnullの間は在席中を意味する。
  `lat`/`lng`はエリア内にいる間の現在地（2026-08-17、開発者の希望でエリア内の
  正確な位置を友達に共有する方針に決定）。更新頻度（リアルタイム更新か否か）・
  精度・退室後の削除ポリシーは未決定（別途検討）

## 設計上の重要な原則

1. 「個人がエリアを使う（USER_AREAS）」と「友達に名前を見せる
   （FRIEND_AREA_LINKS）」は必ず分離する。混同するとプライバシー事故の
   原因になる
2. 名前表示のロジックは、必ず `FRIEND_AREA_LINKS.status = 'approved'`
   をチェックしてから行うこと。`PRESENCE_LOGS`だけを見て名前を出す実装は
   禁止（エリア同士が重なっている場合に、紐づいていない相手の名前が
   誤って見えてしまう）
3. 物理削除が必須なのは**アカウント退会時**。退会時は位置情報・友達関係など
   機微データを含め、すべて物理削除する（PRDのプライバシー方針に基づく）。
   一方、友達解除・グループ退会のような通常操作（アカウント自体は残る）は、
   ソフトデリート（`status`列の変更など）で構わない
4. グループ機能（US-006など）を追加する際は、`GROUPS`・`GROUP_MEMBERS`・
   `GROUP_AREA_LINKS`を新規テーブルとして追加し、既存テーブルは変更しない
   方針とする
