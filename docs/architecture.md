# システムアーキテクチャ

## コンポーネント構成

```
OS位置情報サービス --(expo-location経由)--> モバイルアプリ(Expo/React Native) ⇄ Supabase --> プッシュ通知配信
                                                                                    │              │
                                                                                    ├ PostgreSQL DB │
                                                                                    ├ Realtime      │
                                                                                    └ Edge Functions │
                                                                                                     ↓
                                                                                              モバイルアプリ
                                                                          （OS経由、アプリを閉じていても届く）
```

- 「OS位置情報サービス」は独立したシステム（Android Location Services /
  iOS Core Location）で、`expo-location`はそこへアクセスするためのクライアント
  側ライブラリ（＝矢印の手段であって、それ自体はノードではない）
- 「プッシュ通知配信」（Expo Push Service等）は、Supabaseからのリクエストを
  受けて実際に配信処理を行う独立したシステムのため、末端ではなくモバイル
  アプリへ戻る矢印を持つ（アプリが起動していなくてもOSの通知システム経由で
  届く点が、Supabase⇄アプリ間の直接通信＝Realtime購読とは異なる）

- **モバイルアプリ**：位置情報イベントを受け取り、`supabase-js`経由でSupabaseと
  通信する。設計上はOS標準のジオフェンスAPI（`startGeofencingAsync`）を前提と
  しているが、2026-10-01時点では`watchPositionAsync`（フォアグラウンド中心の
  継続取得）で暫定動作しており、本来の実装への切り替えは未着手（詳細は
  「2. アプリのライフサイクル」の節を参照）
- **PostgreSQL DB**：`docs/schema.md`で設計したテーブル本体
- **Realtime**：DBの変化を全端末に配信（クライアント側の再計算負荷を減らす）
- **Edge Functions**：通知の判定ロジックなど、クライアント側に置くと
  セキュリティ・一貫性のリスクがある処理を担当。OTP検証はEdge Functionsでは
  なく、Postgres側のSECURITY DEFINER関数（`redeem_friend_otp`）で実装している
  （2026-09-30、Issue #143/#147。他人の`otp_codes`/`friendships`行を読み書き
  する必要がある処理のため、RLSをまたぐ最小限のロジックをDB関数側に封じ込める
  方針に変更した。行ロック・一意制約の設計詳細は`docs/schema.md`参照）
- **プッシュ通知配信**：Edge Functionsの判断を起点に、Expo Push経由で
  APNs/FCMへ、最終的に端末に届く

### 実装済み：入室通知の配信経路（Issue #131、2026-09-25）

- クライアントは`expo-notifications`でExpoPushTokenを取得し、
  `USERS.push_token`に保存する（`app/hooks/usePushNotificationRegistration.ts`）
- `PRESENCE_LOGS`へのINSERT（＝入室）をSupabase Database Webhookでフックし、
  Edge Function`send-entry-notifications`を起動する（クライアントを信用せず、
  判定・送信はすべてservice role側で行う）
- 通知すべきかの判定（`shouldSendEntryNotification`・
  `shouldSendWantToMeetNotification`）は`app/utils/notifications.ts`と
  `supabase/functions/_shared/notifications.ts`の2箇所に同じロジックを置いている
  （クライアント/Edge Functionでランタイムが異なり、現状ビルド構成を共有できない
  ため。ルール変更時は両方を更新する必要がある）
- Database Webhookのトリガー自体（presence_logsのINSERT→Edge Function呼び出し）は
  環境（dev/prod）ごとにSupabaseダッシュボードから設定する運用とし、
  マイグレーションには含めていない（Edge FunctionのURLが環境ごとに異なるため）

### 実装済み：通知ボックスの残り2種類（Issue #163、2026-10-02）

- `send-entry-notifications`を拡張し、入室した本人向けの`arrival_summary`
  （「今会える人」一覧）も同じ入室イベントから生成する。「会える」判定は
  `FRIEND_AREA_LINKS`基準（そのエリアでの合意がstatus='approved'）に統一
  した（開発者確認済み。名前表示条件と一致させるため、`FRIENDSHIPS`や
  グループ同席は見ない）。entry/want_to_meetとは通知の受信者の向きが逆
  （入室した本人が受信者）のため、別ブロックとして独立に処理する。プッシュ
  通知は送らず、NOTIFICATIONS行の作成のみ行う
- `group_members`へのINSERT（＝グループ参加）をDatabase Webhookでフックし、
  新規Edge Function`send-group-invite-notification`を起動する。
  `invited_by is not null`の行（既存メンバー/オーナーが友達を招待した場合）
  のみを対象にし、自己申請・自己参加（招待コード/QR、オーナー自身の初期行）
  は通知しない
- このWebhookも`send-entry-notifications`と同様、環境ごとにSupabase
  ダッシュボードから設定する運用とする

### 実装済み：アプリ内アカウント削除（Issue #228、2026-10-02）

- Apple App Store審査ガイドライン5.1.1(v)・Google Playのアカウント削除
  ポリシー対応として、設定画面に削除導線を追加した
- `auth.users`の削除（`auth.admin.deleteUser()`）はservice role権限が
  必要でクライアントから直接は行えないため、新規Edge Function
  `delete-account`を追加した。これは既存のWebhookトリガー型（`send-entry-
  notifications`等）とは異なり、**アプリから直接呼び出す**（`supabase.
  functions.invoke('delete-account')`）初めてのEdge Functionである
- 呼び出し元の本人確認は、Authorizationヘッダー（アクセストークン）を
  anon keyクライアントにそのまま渡して`auth.getUser()`で検証し、
  トークンの持ち主自身のIDのみを削除対象にする（他人のアカウントを
  削除できないようにするため、本人確認はservice roleではなくanon+JWTで
  行う）
- Web簡易体験版（Issue #190）からの呼び出しはブラウザのCORSチェック対象に
  なるため、`supabase/functions/_shared/cors.ts`を新設し、プリフライト
  （OPTIONS）・レスポンスの両方にCORSヘッダーを付与する（既存のWebhook
  専用Edge Functionsはサーバー間通信のみのため不要だった）
- `docs/schema.md`「設計上の重要な原則」3.の通り、`USERS.id`が
  `auth.users(id)`への外部キー（`on delete cascade`）のため、
  `auth.users`の削除だけで関連テーブルのほぼ全てが連動して物理削除される。
  `avatars`バケットのアイコン画像のみPostgreSQLの外部キーの対象外のため、
  Edge Function内で明示的に削除する

## 実装方針（この図から導かれる判断基準）

- ジオフェンス判定・PRESENCE_LOGSへの書き込みは**クライアント側**で行う
- 複雑な通知ロジック（US-016, 017, 021の統合通知など）は**Edge Functions側**
  に置く。クライアントに書くと改ざん・実装ばらつきのリスクがあるため
- RLSをまたいで他人の行を読み書きする必要がある処理（OTP検証とFRIENDSHIPS
  作成など）は、**Postgres側のSECURITY DEFINER関数**に最小権限で封じ込める。
  Edge Functionと違い追加のランタイム・デプロイ経路を増やさずに済み、
  行ロック（`FOR UPDATE`）によるトランザクション内での排他制御も行いやすい

---

# ライフサイクルに関する設計

## 1. エンティティの状態遷移（例：FRIEND_AREA_LINKS）

```
pending（提案中・承認待ち）
  ├─ 相手が承認 → approved（名前表示が有効になる）
  └─ 相手が拒否 → rejected（拒否した側のみ、pendingへ再提案可能）
```

この非対称なルール（拒否された側からは再提案できない）は、実装時に
チェック漏れが起きやすいポイント。`initiator_id`と`friend_id`の両方を見て、
「誰が拒否し、誰が再提案しようとしているか」を必ず確認するロジックにすること。

他にも状態を持つエンティティ（`OTP_CODES`の発行→検証→失効、
`PRESENCE_LOGS`の入室→退室など）についても、実装前に同様の図を
描いてから着手するのが望ましい。

## 2. アプリのライフサイクル（フォアグラウンド／バックグラウンド／終了）

**重要：位置情報の取得方式には2つあり、US-004には後者が必須。**

| 状態 | `watchPositionAsync`（素朴な継続取得） | 本来のUS-004実装（`startGeofencingAsync`） |
|---|---|---|
| フォアグラウンド | 位置情報を継続取得 | ジオフェンスイベントで検知 |
| バックグラウンド | 検知されない | OSが継続監視、境界をまたいだ時に検知 |
| 終了 | 検知されない | iOSは一定条件で復帰可能、Androidはより安定 |

`watchPositionAsync`はアプリが開いている間だけ動く「継続的な位置取得」であり、
US-004が求める「エリア外では位置情報を扱わない」「アプリを閉じていても
エリアの出入りを検知する」という要件を満たすには、`expo-location`の
`Location.startGeofencingAsync` + `TaskManager.defineTask`を使った、
OS側に登録する本物のジオフェンシングへの切り替えが必須。

### 未検証のリスク（PRDのOpen Questionsを参照）

- iOSはバックグラウンドでの位置検知の頻度・精度に制限がある
- 実際に5〜10分に1回程度の鮮度要件を満たせるかは、プロトタイプでの
  実地検証が必要（短時間・フォアグラウンド前提の検証だけでは不十分）
- 開発者はiOS実機を保有していないため、自分だけではiOS実機検証ができない
  （配布はiOSも行う予定のため、シミュレータでの確認に加え、TestFlightで
  第三者に検証してもらう等の代替手段が必要）

### 認証（2026-09-19更新、Issue #78・ADR-0010）

ユーザーのアプリ内本人確認は、Supabase Authのメールアドレス＋6桁コード
入力（`signInWithOtp({ email })`で送信、`verifyOtp({ email, token, type:
'email' })`で検証）を使う。デモ用の暫定実装だった匿名ログイン
（[ADR-0007](decisions/0007-auth-anonymous.md)）から本番仕様に移行する
過程で、一度マジックリンク方式（[ADR-0009](decisions/0009-auth-email-magic-link.md)）
を採用したが、メールセキュリティ機能によるリンク事前スキャンで使い捨て
トークンが消費されてしまう問題が実機検証で見つかったため、6桁コード方式
（[ADR-0010](decisions/0010-auth-email-otp-code.md)）に変更した。`USERS.id`は
`auth.uid()`と同じ値になり、RLSポリシーもこれを前提に書かれている
（`supabase/migrations/20260918151313_auth_and_rls.sql`）。

ADR-0007で一度廃止した匿名ログイン（`signInAnonymously()`）は、オープン
グループのQR参加専用の経路として限定的に復活させている（Issue #151、
2026-10-01開発者確認済み）。通常のメールOTPログイン画面はそのまま維持し、
ログイン画面に別のボタンとして用意する。匿名セッションのJWTクレーム
`is_anonymous`（`USERS.is_anonymous`列とは無関係）を使い、friendships作成・
closedグループの作成/参加のRLSから締め出す
（`supabase/migrations/20261001170000_anonymous_open_group_join.sql`）。
本登録アカウントへの昇格導線はIssue #168で別途対応する。

### 本開発着手時にやること

- [ ] `watchPositionAsync`を`startGeofencingAsync`に置き換える
- [ ] バックグラウンド・終了状態からのジオフェンスイベント受信をAndroid実機で
      検証する
- [ ] iOS側は、Xcodeシミュレータでの確認に加え、TestFlight経由で
      第三者のiOS実機による検証を依頼する方法を検討する
- [ ] iOSの同時ジオフェンス数上限（20件）への対応方針を検討する

## 3. 画面構成・ナビゲーション（2026-09-20改訂）

デモ対応・Must/Should実装が進んだ結果、当初想定していた2タブ構成
（ホーム＋友達）から画面数が大きく増えた。react-navigation本導入
（Issue #114）にあわせて、以下の構成に整理する。

### ナビゲーション方式

`react-navigation`のボトムタブナビゲーター（Tab Navigator）を最上位に置き、
各タブの中はスタックナビゲーター（Stack Navigator）でドリルダウンする構成。
これまでの`App.tsx`での条件付きレンダリング（`activeTab === X && <Screen/>`）
と`DemoTabBar`は、react-navigation導入時に置き換える。

### タブ構成（3タブ）

```
Tab Navigator（最上位）
├─ マップ（US-001, 002, 004, 018：地図がベース画面。旧「在席一覧」を統合）
│   └─ Stack:
│       ├─ マップ（メイン）
│       │   - 登録済みエリアを円で表示
│       │   - エリアをタップ → ポップアップ表示（在席者は名前を出さず
│       │     アイコン＋ステータスアイコンのみ、最大3件、4件以上は
│       │     「もっと見る」ボタン。閉じるボタンはバツマーク・右上）
│       │   - 「もっと見る」→ 在席者フルリスト画面へ遷移（旧「在席一覧」
│       │     タブの内容をここに統合、Issue #120）
│       │   - 「＋」ボタン → エリア登録画面へ
│       ├─ エリア登録（US-018：新規作成 or 既存の公開エリアを検索して参加）
│       ├─ エリア管理一覧（自分が作成したエリアの一覧、Issue #104で統合済み）
│       └─ エリア編集（個別エリアの名前・位置・半径編集）
│
├─ 友達・グループ（US-005, 002, 006, 007, 008, 010, 011, 016, 017, 019,
│   Issue #121：内部でセグメント切替）
│   └─ Stack:
│       ├─ 友達一覧（通知送信可否・ミュートのトグルを各行に表示、US-007/008）
│       │   - 友達をタップ → 友達詳細画面へ遷移
│       ├─ 友達詳細（エリア紐づけの提案・承認（FRIEND_AREA_LINKS）＝
│       │   Issue #221/#272、滞在予定の閲覧＝US-011の「共通エリアを持つ
│       │   友達の予定を見る」側、ブロック・削除の「…」メニュー＝US-008
│       │   （Issue #271/#276）、会いたい人指定＝US-017。実装済み）
│       ├─ グループ一覧（自分が所属するグループ、承認待ちの表示含む）
│       ├─ グループ詳細（種別・公開期限表示、承認待ち一覧・メンバー一覧・
│       │   強制退会・自主退会・権限譲渡を「管理者メニュー」に整理、US-006/010/019、
│       │   Issue #263、実装済み）
│       ├─ 友達追加（自分のOTP表示のみ、US-005。相手のコードを読み取る/
│       │   入力する側はIssue #208で下記「コードを読み取る・入力する」に統合）
│       ├─ グループ作成（Issue #116、実装済み）
│       ├─ グループ参加（届いた招待の一覧から承諾/辞退、Issue #117、実装済み。
│       │   設定タブの通知ボックスからも同じ画面に遷移できる）
│       └─ コードを読み取る・入力する（Issue #208：友達追加のOTP・グループの
│           招待コードを1画面で判別。まずグループ招待コードとして検索し、
│           見つからなければ友達OTPとして検証する。カメラQRスキャンは
│           Web非対応のためPlatform.OSで出し分ける）
│
│   一覧画面（友達一覧・グループ一覧）にはフローティングボタンを配置し、
│   押すと「グループ作成」「グループ参加（招待の承諾）」
│   「コードを読み取る・入力する」「友達追加」の4択を表示する。
│   グループを検索して参加申請する機能（旧「グループ参加申請」、Issue #119）
│   はIssue #202で廃止した（open/closedの種別が整理された結果、現在の設計
│   と矛盾するため。詳細は`docs/schema.md`のGROUPSの項参照）
│
└─ プロフィール（2026-09-27、「設定」から名称を戻した。アイコン・名前・
    ステータス編集がトップ、詳細設定は歯車アイコンから別画面へ）
    └─ Stack:
        ├─ プロフィールトップ（アイコン・表示名・ステータス編集、US-014等。
        │   右上に滞在予定・通知ボックス・設定の各アイコンを配置）
        │   - 匿名モードのワンタップ切替（US-013）をここに配置
        │   - 自分の滞在予定の登録・編集（US-011の「自分の基本予定＋当日上書き」
        │     側）へのリンクをここに配置
        ├─ 設定（歯車アイコンから遷移。表示モード・入室通知関連・匿名モード・
        │   アカウント削除を配置、実装済み）
        └─ 通知ボックス（ベルアイコンから遷移。グループへの招待をここから
            直接承諾できる。実装済み）
```

### 決定事項の補足

- **「在席一覧」は独立タブとして持たない**。マップ画面のポップアップ＋
  フルリストに統合する（2026-09-20、開発者の判断）
- **「エリアに参加する」という概念は無い**。エリアはUSER_AREASへの登録
  （自分でエリアを登録する、または検索して既存の公開エリアを監視対象に
  追加する）で成立するもので、旧「エリア参加」タブ（QR/コード入力、
  Issue #65・#106で削除済み）はデモ用の近道に過ぎなかった
- **グループへの参加経路はtypeに応じて2通りに統一されている**（Issue #202、
  2026-10-02開発者確認済み）：
  - closed＝誰かから届いた招待を承諾する（`GROUP_MEMBERS.invited_by`）
  - open＝招待コード/QRを知っていれば承認不要で即参加できる（Issue #148）
  - 「グループを検索して参加申請し、管理者の承認を待つ」経路（旧
    `GROUPS.is_public`、Issue #119）はこの2通りと矛盾するため廃止した
- **US-004（ジオフェンス判定）は独立したタブ・画面を持たない**。バックグラウンド
  ロジック＋権限リクエストのアラート/モーダルとして、どのタブからでも
  発生しうる横断的な機能として扱う（変更なし）
- 画面ファイル（`app/screens/`配下）は、どのタブに属するか分かるように
  ディレクトリを分ける：
  ```
  app/screens/
  ├── map/           ← マップタブ関連（地図・エリア登録・エリア管理・
  │                     在席者ポップアップ/フルリスト）
  ├── friends/        ← 友達・グループタブ関連（友達一覧・OTP入力・QR読み取り）
  ├── groups/         ← 友達・グループタブ関連（グループ一覧・詳細・作成・参加）
  └── settings/       ← 設定タブ関連（旧profile/ディレクトリから改名）
  ```
- 複数のUser Storyで使い回す計算・処理（緯度経度間の距離計算など）は、
  特定のUS用ディレクトリに埋め込まず`app/utils/`にまとめる。
  例：`app/utils/geo.ts`（距離計算、US-004・US-018で共有）。重複実装を防ぐため、
  新しい計算処理を書く前に既存の`app/utils/`配下を確認する

### Web版（ブース展示向け簡易体験版、Issue #190、2026-10-01〜）

ネイティブ配布（Android APK・iOS TestFlight）に加え、ブース展示の保険として
`expo start --web` / `expo export -p web`で動くブラウザ版を用意している。
ファイル単位の分割ではなく、`Platform.OS === 'web'`による分岐を基本方針とし、
react-native-mapsやexpo-cameraなど一部のネイティブ専用モジュールに依存する
箇所だけを置き換える：

- **マップタブ**：`navigation/MapStackNavigator.web.tsx`（`.web.tsx`拡張子で
  Web版のみバンドル）が、react-native-maps依存の画面を一切マウントせず、
  「タブを開いたままにしてください」という案内（`WebDemoNotice`）のみを表示する
- **コードを読み取る・入力する**（Issue #208のRedeemCodeScreen）：カメラQR
  スキャン部分のみ`Platform.OS`で出し分け、Web版は手入力のみ
- **ジオフェンス検知**：`useGeofenceMonitor`は無改修で流用。`expo-location`の
  `watchPositionAsync`が公式にWeb実装（`navigator.geolocation.watchPosition`
  のラッパー）を提供しているため動く。ただしブラウザのGeolocation APIは
  `timeInterval`/`distanceInterval`を無視するため、実際の位置変化が無いと
  コールバックが再発火しない制約がある（デスクトップブラウザ等、位置が
  完全に静止し続ける環境では検知が遅れうる、既知の制約として記録のみ）
- Web版は「タブを開いたまま・フォアグラウンドでいる間だけ」動く縮小版で
  あることを明示する（oruca本来の「アプリを閉じていても検知する」という
  体験は再現できない）。クローズグループ・友達関連機能はWeb版のスコープ外
- ホスティングは開発者の既存Vercelアカウントへ`vercel --prod`でデプロイする
  想定（`app/vercel.json`、static export出力先`dist/`、SPA rewrite設定済み）

### 未確定・今後決める点（2026-10-02時点で解消済み）

- エリア登録・エリア管理画面の遷移方法 → react-navigation導入（Issue #114）
  によりStack遷移に置き換え済み
- グループ詳細画面からの「招待する」ボタンの具体的な位置づけ（Issue #117）
  → グループ詳細画面に常設のボタンとして実装済み

## 4. 実機テスト用のExpo開発サーバーのポート割り当て（2026-08-16）

複数の実装チャットが同時にExpo Goでの実機テストを行えるよう、`npx expo start`
実行時のポートをUSごとに固定する（デフォルトの8081のままだと、複数チャットが
同時に起動した際に衝突するため）。

| US | ポート |
|---|---|
| US-001 | 8081（デフォルト） |
| US-002 | 8082 |
| US-004 | 8083 |
| US-005 | 8084 |
| US-018 | 8085（※Expo Goでは動作しない、下記注記参照） |
| 以降のUS | 8086, 8087...と割り当てる |

起動コマンド例：`npx expo start --port 8083`（US-004の場合）。スマホの
Expo Goアプリで表示されたQRコードを読み込むと、実機で動作確認できる
（Macとスマホが同じWi-Fiに接続されている必要がある）。

**注意（US-018）**：`react-native-maps`・`@react-native-community/slider`は
ネイティブモジュールを含むため、Expo Goでは動作しない
（`docs/decisions/0006-map-library.md`参照）。US-018を実機・エミュレータで
確認する場合は、`npx expo run:android`/`npx expo run:ios`でdevビルドを
作成する必要がある（`npx expo start --port`だけでは動かない）。
