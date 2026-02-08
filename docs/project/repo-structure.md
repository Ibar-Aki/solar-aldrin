# Repository Structure & File Placement Rules

作成日時: 2026-02-07 15:19:21 +09:00
作成者: Codex+GPT-5

本ドキュメントは、`solar-aldrin` レポジトリ内での「ファイルを置く場所」を明確化し、散らかりを予防するためのルールです。

## Top-Level

- `README.md`: リポジトリ入口（概要、主要リンク）
- `AGENTS.md`: エージェント運用ルール
- `apps/`: アプリ本体（v1 / v2）
- `docs/`: プロジェクト横断ドキュメント
- `learning/`: 学習メモ（運用・設計の知見）
- `scripts/`: リポジトリ横断の運用スクリプト

## Docs

- `docs/project/`: プロジェクト横断ドキュメント（コア文書、横断レポート、運用ルール）
- `apps/*/docs/`: 各アプリ固有ドキュメント（要件・設計・レビューなど）

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
