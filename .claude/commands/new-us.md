---
description: 指定したUser Story（Issue番号）用のgit worktreeを新規作成し、作業開始の準備をする
---

Issue番号 $ARGUMENTS のUser Story用に、git worktreeを新規作成してください。

1. `gh issue view $ARGUMENTS --repo Greek-Academy/oruca` でIssueのタイトルを確認する
2. タイトル（例：`US-018: エリア登録機能（地図ピン+半径指定）`）から、US番号と機能名を
   読み取り、`feature/us-XXX-機能名`のブランチ名を決める（既存の命名規則は
   `git worktree list`で確認できる）
3. `git worktree add -b feature/us-XXX-機能名 ../oruca-worktrees/us-XXX main`
   を実行する（`main`ブランチを起点にする）
4. `app/node_modules`のシンボリックリンクを張る：
   `ln -s /Users/asuka/alpha/oruca/app/node_modules ../oruca-worktrees/us-XXX/app/node_modules`
5. 作成したディレクトリのパス（`~/alpha/oruca-worktrees/us-XXX`）を報告し、
   そこに`cd`してから作業を始めるよう案内する

worktreeは実際に着手する直前にだけ作成する（事前にまとめて作らない）方針なので、
このコマンドは新しいUser Storyに着手するタイミングで都度実行する。
