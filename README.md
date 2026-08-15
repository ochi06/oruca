# oruca

大学やオフィスなどの特定エリアに入った時だけ位置情報を検知し、
それ以外の場所・時間のデータは保存・送信しない、エリア限定・関係限定の
在席可視化アプリ。詳細は `docs/prd.md` を参照。

コンペティブプログラムへの提出を目標に、2月まで開発を継続する。

## リポジトリの構成

```
oruca/
├── CLAUDE.md         AIエージェント（Claude Code）向けの開発方針リファレンス
├── docs/             設計ドキュメント一式
│   ├── prd.md                    PRD要約版
│   ├── schema.md                 DB設計（ER図）
│   ├── architecture.md           システム構成・ライフサイクル設計
│   ├── ai-collaboration-plan.md  User Story単位のAI/自分の役割分担
│   └── decisions/                技術選定・設計判断の記録（ADR）
├── demo/             合宿デモ用の緊急モック（本番実装ではない）
└── app/              本開発用の本番アプリ（これから作成）
```

## 開発の進め方

1. 設計・方針は必ず `docs/` を参照してから着手する
2. AIと実装する際の役割分担は `docs/ai-collaboration-plan.md` を確認する
3. 本開発用のアプリは `app/` に作成する（`npx create-expo-app app` を想定）

## セットアップ

本番アプリのセットアップ手順は `app/README.md`（作成後）を参照。
合宿デモ版のセットアップは `demo/README.md` を参照。
