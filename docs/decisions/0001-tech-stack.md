# ADR-0001: 技術スタックの選定

## 決定事項

- フロントエンド：React Native + Expo + TypeScript
- バックエンド／DB：Supabase（PostgreSQL）

## 理由

### React Native + Expo
- クロスプラットフォーム対応が必要（実機はAndroidのみ保有）
- 開発者はモバイル開発の立ち上げ経験がなく、環境構築の複雑さが
  最大のリスクだったため、環境構築が容易なExpoを採用
- 将来ネイティブ機能が必要になった場合も `expo prebuild` で
  ネイティブプロジェクトに移行できるため、後戻りできない選択ではない
- MVPはiOS/Android。将来的にiPad対応も見込むが、これは同じRN+Expo
  コードベースでレスポンシブ対応すればよく、追加の技術選定は不要
- 一方、Apple Watch（watchOS/SwiftUIが必要）とPC（デスクトップ向けの
  別ランタイムが必要）はReact Native + Expoの対象範囲外。対応する場合は
  本ADRとは別に技術選定が必要（現時点では未着手）

### TypeScript（JavaScriptではなく）
- AIと伴走しながら開発する方針のため、型があることでAIの実装ミスを
  エディタ上で早期検知できる
- 業界の標準になりつつあり、キャリア面でも学ぶ価値が高い

### Supabase（Firebaseではなく）
- 開発者はDB設計を自分の手で行いたいという意向があり、
  リレーショナルデータベース（PostgreSQL）の方が、ER図設計・正規化・
  SQLといった、面接で語れる土台の知識を学べる
- oruca自体のデータ構造（ユーザー・エリア・友達関係・グループの
  多対多関係）がリレーショナルデータベース向きである

## 見送った選択肢

- Firebase（Firestore）：NoSQLのため、DB設計の学習効果が薄いと判断
- Flutter：JavaScript/TypeScriptとの言語統一（フロント・バックエンド）の
  メリットを優先し見送り
