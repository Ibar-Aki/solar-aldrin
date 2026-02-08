# Agent Skill 定義ガイド

AIエージェントの機能を拡張する「Skill」の定義方法について解説します。
Skillを作成することで、特定のタスク（コードレビュー、リファクタリング、セキュリティ診断など）におけるエージェントの振る舞いを標準化し、高品質な成果物を安定して出力できるようになります。

## 1. ディレクトリ構造

Skillは `.agent/skills` ディレクトリ配下に、個別のフォルダとして配置します。

```
.agent/skills/
└── [skill_name]/         # スキル名（小文字・スネークケース）
    ├── SKILL.md          # 必須：メインの定義ファイル
    ├── scripts/          # オプション：補助スクリプト
    │   └── analyze.py
    └── examples/         # オプション：出力例やテンプレート
        └── report.md
```

## 2. SKILL.md のフォーマット

YAMLフロントマターを持つMarkdownファイルとして記述します。

```markdown
---
name: [Skill Name]
description: [Short description of what this skill does]
---

# Instructions

You are an expert in [Topic]. Your goal is to...

## Process

1. **Step 1**: ...
2. **Step 2**: ...

## Output Format

Please output the result in the following format:

...
```

### 重要な構成要素

* **name**: エージェントが認識するスキル名。
* **description**: どのような時にこのスキルを使うべきかの説明。
* **Instructions**: プロンプトエンジニアリングの要領で、「何者として」「何を」「どのような手順で」行うかを詳細に記述します。
* **Rules/Constraints**: 「やってはいけないこと」や「必ず守るべきルール」を明記します（例：「コードを削除する際は必ずバックアップを取ること」）。

## 3. スクリプトとの連携

複雑な処理（大規模な静的解析、DB操作など）は、エージェントにコマンドを叩かせるだけでは不安定な場合があります。
その場合、`scripts/` フォルダに Python や PowerShell スクリプトを用意し、エージェントにはそのスクリプトを実行するように指示します。

```markdown
## Execution

Please run the following command to analyze the code:

`python .agent/skills/security_audit/scripts/scanner.py --target ./src`
```

## 4. コンテキストの注入

エージェントは実行時にコンテキスト（現在のファイル、ユーザーの意図）を持っていますが、Skillを使用する際は、Skill固有の知識（用語集、特定のコーディング規約など）をMarkdown内に含めると効果的です。

## 具体例: コードレビュー Skill

* **目的**: プルリクエストの品質チェック
* **手順**:
    1. `git diff` で変更差分を取得
    2. Lintエラーがないか確認
    3. セキュリティ上の懸念（SQLインジェクションなど）がないかチェック
    4. 可読性（変数名、関数長）を評価
    5. 結果をMarkdownレポートとして出力
