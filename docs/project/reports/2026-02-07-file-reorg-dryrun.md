# File Reorganization Dry Run Report (2026-02-07)

作成日時: 2026-02-07 15:19:21 +09:00
作成者: Codex+GPT-5

本レポートは、既存ファイルの **移動 / ファイル名変更 / 削除** を行う前提で、影響範囲と実施内容を「ドライラン」として整理したものです。

## 対象

- Git root: `solar-aldrin`
- 対象範囲: ルート直下 + `apps/v1-legacy/` + `apps/v2-modern/` + `docs/` + `learning/` + `scripts/`

## 変更一覧（予定）

| 種別 | From | To | 理由 |
| --- | --- | --- | --- |
| MOVE+RENAME | `PROJECT_MASTER_PLAN.md` | `docs/project/core/project-master-plan.md` | コア文書を集約＋命名統一 |
| MOVE+RENAME | `REQUIREMENTS_DEFINITION.md` | `docs/project/core/requirements-definition.md` | 同上 |
| MOVE+RENAME | `ARCHITECTURE_DESIGN.md` | `docs/project/core/architecture-design.md` | 同上 |
| MOVE+RENAME | `implementation_plan_report.md` | `docs/project/reports/implementation-plan-report.md` | 横断レポートを集約＋命名統一 |
| MOVE+RENAME | `03_最適化施策レポート.md` | `docs/project/reports/optimization-measures-report.md` | 同上 |
| MOVE+RENAME | `スケール課題と対応策レポート.md` | `docs/project/reports/scale-issues-countermeasures-report.md` | 同上 |
| MOVE+RENAME | `詳細セキュリティチェックリスト.md` | `docs/project/security/detailed-security-checklist.md` | セキュリティ文書を集約＋命名統一 |
| MOVE+RENAME | `apps/v2-modern/implementation_plan.md` | `apps/v2-modern/docs/00_planning/phases/phase2-implementation-plan.md` | v2ドキュメントの置き場へ集約＋命名統一 |
| MOVE+RENAME | `apps/v2-modern/review.md` | `apps/v2-modern/docs/30_reviews/harsh-review.md` | v2レビューを所定場所へ＋命名統一 |
| DELETE | `apps/v2-modern/temp_req.json` | （削除） | 参照がなく、内容が一時ファイルのため |
