# ADR-0002: 合宿デモ用の緊急対応と、本開発再開時に戻すべき点

## 背景

合宿中に「その場にいる人数・位置を見せる」デモが急遽必要になり、
1日未満で動くものを用意する必要があった。正式な設計（`docs/schema.md`）を
実装する時間がないため、意図的に以下の近道を取った。

## 取った近道

1. **単一の `presence` テーブルのみ使用**
   `USERS` / `AREAS` / `USER_AREAS` / `FRIENDSHIPS` / `FRIEND_AREA_LINKS`
   などの正式なテーブルは作らず、`device_id, display_name, latitude,
   longitude, updated_at` のみを持つ `presence` テーブル1つで代用した

2. **エリアはコード内に固定値でハードコーディング**
   `App.tsx` 内の `AREA` 定数（緯度・経度・半径）で表現。US-018の
   エリア登録画面は未実装

3. **認証なし。RLSポリシーが「誰でも読み書き自由」**
   ```sql
   create policy "allow all for demo" on presence
     for all using (true) with check (true);
   ```
   本来はSupabase Authでユーザーを識別し、適切なポリシーで絞り込む必要がある

4. **名前は自己申告（AsyncStorageに保存するだけ）**
   なりすまし防止（US-005のOTP認証）は未実装。合宿参加者が善意で
   正しい名前を入れる前提の、デモ限定の仕組み

5. **リアルタイム購読ではなくポーリング（5秒ごとの再取得）**
   Supabase Realtimeのpostgres_changes購読は使わず、`setInterval`で
   定期的に全件取得する方式にした。設定の手間を減らし、確実に動く
   ことを優先した

## 本開発再開時にやること

- [ ] `presence` テーブルを廃止し、`docs/schema.md` の正式スキーマに移行
- [ ] RLSポリシーを、認証済みユーザー本人および承認済みの関係者のみに
      絞り込む形に書き換える
- [ ] US-005（OTP友達追加）を実装し、なりすまし防止を有効にする
- [ ] US-018（エリア登録画面）を実装し、ハードコーディングされた
      `AREA` 定数を廃止する
- [ ] ポーリングをSupabase Realtimeのpostgres_changes購読に置き換え、
      サーバー負荷とレイテンシを改善する
- [ ] 名前表示のロジックを `FRIEND_AREA_LINKS.status = 'approved'` の
      チェックを通す形に変更する（現状は無条件で全員の名前が見える）
