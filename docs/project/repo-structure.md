# Repository Structure & File Placement Rules

作成日時: 2026-02-07 15:19:21 +09:00
作成者: Codex+GPT-5

本ドキュメントは、`solar-aldrin` レポジトリ内での「ファイルを置く場所」を明確化し、散らかりを予防するためのルールです。

## Top-Level

- `README.md`: リポジトリ入口（概要、主要リンク）
- `AGENTS.md`: エージェント運用ルール
- `apps/`: アプリ本体（v1 / v2）
- `docs/`: プロジェクト横断ドキュメント & 技術ナレッジ
- `scripts/`: リポジトリ横断の運用スクリプト

## Docs Structure

### Project & Knowledge (`docs/`)

- `docs/project/`: プロジェクト横断ドキュメント（コア文書、レポート、運用ルール）
- `docs/learning/`: 学習メモ（運用・設計の知見、技術ノート）
- `docs/agent/`: AIエージェント設定・運用ルール

### Apps (`apps/*/docs/`)

各アプリケーションの `docs/` は以下の構造で統一します（v2推奨）:

```text
docs/
├── 00_overview/      # プロジェクト概要・アーキテクチャ
├── 10_planning/      # 計画・ロードマップ・要件定義
├── 20_phases/        # Phase別ドキュメント
├── 30_design/        # 設計書
├── 40_manuals/       # 運用マニュアル
└── 50_reviews/       # レビュー・レポート + archive/
```

## Artifacts / Outputs

以下はGit管理しない（`.gitignore` で除外）:

- `**/node_modules/`
- `**/dist/`
- `**/playwright-report/`, `**/test-results/`
- `apps/**/reports/`
- `**/.wrangler/`
- `**/.env*`（例外: `**/.env.example`）
- `**/.dev.vars`（例外: `**/.dev.vars.example`）

## Markdown Rules (Summary)

- 新規 `.md` には `作成日時` と `作成者`（例: `Codex+GPT-5`）を必ず記載
- 既存 `.md` を更新する場合は `更新日: YYYY-MM-DD` を追記/更新
- ファイル名は英語PascalCase推奨（例: `01_DesignSpec.md`）
