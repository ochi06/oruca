# 画面遷移アニメーションの検討たたき台（Issue #40）

**位置づけ**：2026-08-16時点で未決定・後回しとされていたIssue #40の調査結果。
現状はReact Navigationの標準アニメーションのまま（独自設定なし）で、本
ドキュメントは変更するかどうかの判断材料をまとめたたたき台。実装はしていない。

## 1. 現状の構成

- `@react-navigation/native-stack` v7.19.2・`@react-navigation/bottom-tabs`
  v7.19.2を使用（`app/navigation/`配下）
- Stack Navigator（`FriendsGroupsStackNavigator`・`MapStackNavigator`・
  `SettingsStackNavigator`）は3つとも`screenOptions={{ headerShown: false }}`
  のみで、`animation`オプションは未指定＝プラットフォームデフォルト
  （iOS: ネイティブのスライドイン、Android: Material標準の遷移）
- タブ切り替え（`RootTabNavigator`、下部タブ）側も`animation`未指定で、
  bottom-tabsのデフォルト（アニメーション無し、即切り替え）のまま
- 独自のトランジション・共有要素アニメーション等は未実装

## 2. react-navigation v7で選べる主な選択肢

### Native Stack（画面プッシュ/ポップ時）
`animation`オプションに以下が指定できる：
- `default`：プラットフォームデフォルト（現状の挙動）
- `fade` / `fade_from_bottom`
- `flip`（iOSのみ有効、Androidはdefaultにフォールバック）
- `simple_push`（iOSのみ。影とヘッダーの遷移を省いたプッシュ）
- `slide_from_right` / `slide_from_left`（Androidのみ有効）
- `none`（アニメーション無し、即切り替え）
- `slide_from_bottom`（モーダル的な見せ方に近い。`presentation: 'modal'`と
  組み合わせる使い方が一般的）

### Bottom Tabs（タブ切り替え時）
- `none`（現状のデフォルト）
- `fade`
- `shift`（タブ間をスライドしつつクロスフェード）

## 3. Web（Issue #190簡易体験版）への影響

- Native Stackのアニメーションは`react-native-screens`のネイティブ実装に
  依存しており、Web版では事実上効かない（即切り替えに近い見た目になる）
  可能性が高いが、**実機・実ブラウザでの確認はできていない**ため確度は
  高くない。採用するアニメーションを決めた後、Web版での見え方は別途
  Playwrightまたは手動確認が必要
- そのため、本検討は主にiOS/Android実機での体験を対象とする前提で整理する

## 4. トレードオフ

- **現状維持（プラットフォームデフォルトのまま）**
  - 長所：追加コストゼロ。OS標準の挙動に合わせることで、ユーザーが普段
    使っている他アプリと体感が揃う（iOSとAndroidでそれぞれのOSらしい動き）
  - 短所：iOS/Androidで見た目が異なる（統一感を出したい場合は不利）
- **独自のアニメーションに統一する（例：全プラットフォームで`fade`）**
  - 長所：ブランドとして一貫した体験を作れる。`docs/design-system.md`の
    「スタイリッシュ・クリーン基調」に寄せた演出を作り込める
  - 短所：OS標準から外れるため、プラットフォームの「その場所にいる感覚」
    （iOSのスワイプバック等）との整合を個別に確認する手間が増える。
    `animation`を変えると`fullScreenGestureEnabled`等ジェスチャー関連の
    デフォルト値も連動して変わる場合があるため、変更時は戻るジェスチャーの
    挙動も合わせて確認が必要（v7の`types.tsx`に、`animation:
    'slide_from_bottom'`指定時はジェスチャー関連オプションのデフォルトが
    自動で変わる旨の記載あり）
- **タブ切り替えだけ`shift`等に変える**
  - 長所：画面プッシュ側（Stack）は現状維持しつつ、タブ切り替えだけ
    演出を足す小さな変更で済む
  - 短所：効果は限定的（体感上の変化は小さい）

## 5. 懸念点・開発者に判断してほしい論点

1. **そもそも変更する価値があるか**：OS標準のままで体験上の問題は出ていない
   （現状、画面遷移に関する不具合・違和感の報告は無い）
2. 変更する場合、**Stack（画面プッシュ）とTabs（タブ切り替え）のどちらを
   対象にするか**、両方か
3. **iOS/Androidで統一した見た目にするか、プラットフォームデフォルトを
   尊重するか**
4. Web版（Issue #190）での見え方を確認する優先度（ブース展示がネイティブ
   実機中心であれば優先度は低いが、方針としては明記しておきたい）

## 6. 工数感

- `animation`オプションの指定自体は各Navigatorの`screenOptions`に1行足す
  だけで、実装コストは非常に小さい
- 選んだアニメーションによっては、ジェスチャー関連オプションの副作用確認・
  実機での見た目確認（特にiOS/Android双方）に多少の時間がかかる
