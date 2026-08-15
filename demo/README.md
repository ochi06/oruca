# oruca 合宿デモ用モック

これは本番実装ではなく、合宿デモのために1日未満で用意した緊急対応版。
正式な設計は `../docs/` を参照。ここで取った近道の一覧と、本開発時に
戻すべき点は `../docs/decisions/0002-demo-shortcuts.md` にまとめてある。

## 事前準備1：Google Maps APIキー（地図を表示する場合）

**Android用の設定。iOSは`react-native-maps`が標準でApple純正の地図を使うため、
このAPIキーは不要。**

1. https://console.cloud.google.com/ でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」→「Maps SDK for Android」を有効化
3. 「認証情報」→「認証情報を作成」→「APIキー」を発行

※ 時間がなければ `App.tsx` 内の `SHOW_MAP` を `false` にすることで、
  地図なしの「人数カウントのみ」画面に切り替えられる。

## 事前準備2：Supabaseプロジェクト

1. https://supabase.com でプロジェクトを作成
2. 左メニュー「SQL Editor」で以下を実行

```sql
create table presence (
  device_id text primary key,
  display_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);

alter table presence enable row level security;

create policy "allow all for demo"
  on presence
  for all
  using (true)
  with check (true);
```

**注意**：このポリシーはデモ専用の緩い設定。本開発では
`docs/schema.md` の正式なテーブル・RLSに置き換える。

3. 「Project Settings」→「API」から Project URL と anon public key を取得

## セットアップ手順

```bash
npx create-expo-app oruca-mock --template blank-typescript
cd oruca-mock
npx expo install expo-location react-native-maps @react-native-async-storage/async-storage
npm install @supabase/supabase-js react-native-url-polyfill
```

1. この `demo/App.tsx` を作成したプロジェクトの `App.tsx` に上書きコピー
2. この `demo/lib/supabase.ts` を `lib/supabase.ts` としてコピー
3. プロジェクト直下に `.env` ファイルを作成し、以下を記入する
   （このファイルは`.gitignore`で除外されるので、絶対にコード側に
   直接書き込まないこと）

```
EXPO_PUBLIC_SUPABASE_URL=SupabaseのProject URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=Supabaseのanon public key
```

4. `demo/app.json.additions.md` の内容を `app.json` に追記
5. `App.tsx` 内の `AREA` を実際の合宿場の緯度経度に書き換え

## 実行方法

```bash
npx expo start
```

QRコードを各自の実機の Expo Go アプリで読み取る（Android・iOSどちらでも参加可能）。

### 開発者本人の動作確認（iOS実機なしのため）

開発者はiOS実機を持っていないため、自分の確認はAndroid実機 + iOSシミュレータで行う。
`npx expo start`実行後、ターミナルで`i`キーを押すとiOSシミュレータが起動する
（Xcodeのインストールが必要。Macのみ対応）。

### 配布にストアの開発者アカウントは不要

参加者がインストールするのは、Expo社が公開済みの汎用アプリ「Expo Go」
（AndroidはPlay Store、iOSはApp Storeからそれぞれ無料インストール可能）。
あなたのコードは`npx expo start`でその場で配信され、Expo Goがそれを読み込んで
実行する仕組みなので、Google Play・App Storeへの公開もアカウント取得も不要。

- 全員が合宿会場の同じWi-Fiに繋がっていれば、上記の`npx expo start`だけで動く
- 参加者の一部が別ネットワーク（モバイル回線など）にいる場合は、代わりに以下を使う

```bash
npx expo start --tunnel
```

このオプションはExpoのトンネル経由で配信するため、同じネットワークにいなくても繋がる（起動はやや遅くなる）。

## 動作確認のポイント

- 地図が真っ白（Android）：Google Maps APIキーを確認。間に合わなければ
  `SHOW_MAP`を`false`に
- 地図が真っ白（iOS）：位置情報の使用許可（設定アプリ or 初回起動時のダイアログ）
  が許可されているか確認
- 人数が増えない：`SUPABASE_URL`・`SUPABASE_ANON_KEY`が全員同じ値か確認
