# Solar-Aldrin Agent Configuration

This file contains project-specific rules and conventions for the AI agent.

---

## ドキュメント作成ルール

### ディレクトリ構造

```
apps/v2-modern/docs/
├── 00_overview/      # プロジェクト概要（全体説明、アーキテクチャ）
├── 10_planning/      # 計画・ロードマップ（要件定義、機能カタログ）
├── 20_phases/        # Phase別ドキュメント（DecisionMatrix、実装計画）
├── 30_design/        # 設計書（API設計、データモデル、UX設計）
├── 40_manuals/       # 運用マニュアル（ユーザーガイド、OPS手順）
└── 50_reviews/       # レビュー・レポート + archive/（日付付き一時レポート）
```

### ファイル命名規則

1. **採番**: すべてのファイルに2桁の採番を付与（例: `01_`, `02_`, ...）
2. **言語**: 英語ベース（PascalCase）
3. **形式**: `NN_DescriptiveName.md`
   - 例: `01_SystemArchitecture.md`, `05_FAQ.md`
4. **日付付きファイル**: `YYYY-MM-DD_DescriptiveName.md` 形式で、`archive/` に格納

### 格納先ルール

| ドキュメント種別 | 格納先 |
|------------------|--------|
| プロジェクト概要、セットアップ | `00_overview/` |
| 要件、ロードマップ、機能カタログ | `10_planning/` |
| Phase別資料（DecisionMatrix、実装計画） | `20_phases/` |
| 設計書（API、データモデル、UX） | `30_design/` |
| 運用マニュアル、ユーザーガイド | `40_manuals/` |
| 完了レポート、レビュー、タスクログ | `50_reviews/` |
| 一時的な日付付きレポート | `50_reviews/archive/` |

### 新規ファイル作成時の注意

1. 既存の採番を確認し、連番を付与
2. 類似ドキュメントがないか確認（重複防止）
3. 内容がコードと整合しているか確認
4. 日本語の内容でも、ファイル名は英語

---

## コード規約

- TypeScript: Strict mode
- Zod: スキーマ定義に使用
- Hono: Workers APIフレームワーク
- Zustand: フロントエンド状態管理

---

## その他のルール

- GitHubへのプッシュはユーザーの明示的な指示があった場合のみ
- Implementation Plan/Taskを提示したら、ユーザーの "OK" を待つ
