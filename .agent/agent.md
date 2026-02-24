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

### コード品質ガイドライン（教訓メモ）

- **ファイルサイズ上限**: 1ファイル500行を目安。超えたら分割を検討する
- **型定義の一元化**: `Bindings`/`KVNamespace` などの共通型は `workers/types.ts` に集約する
- **改行コード注意**: ファイル編集時は CRLF/LF の混在に注意（特に replace 操作はファイル破損リスクあり）
- **ドキュメント同期**: コード変更時は対応する `docs/` を必ず確認し、主要指標（コンポーネント数・テスト数・ファイル構成）を更新する
- **デフォルトモデルの統一**: `chat.ts` と `feedback.ts` など複数ファイルでデフォルトAIモデルが食い違わないように注意する

---

## デプロイ前チェックリスト

デプロイ (`wrangler deploy` / `wrangler pages deploy`) を実行する前に以下を確認すること:

1. **ビルド成功**: `npm run build` でエラーゼロ
2. **テスト全パス**: `npm run test` で全件グリーン
3. **Preflight Check**: `.agent/skills/preflight_check/check_status.ps1` を実行
4. **環境変数確認**: `.dev.vars` と `wrangler.toml` に必要なキーが揃っているか確認
   - `OPENAI_API_KEY` または `GEMINI_API_KEY`
   - `API_TOKEN`

---

## Git 操作ルール

- **コミット**: ユーザーの明示的な指示があるまで行わない
- **プッシュ**: ユーザーの明示的な指示があるまで行わない
- **Implementation Plan/Task を提示したら**: ユーザーの "OK" を待つ
- **pre-push hook**: `.githooks/pre-push` が設定済み（`core.hooksPath = .githooks`）。回避が必要な場合は `git push --no-verify` を使うが、必ずユーザーに確認を取ること

---

## 利用可能な SKILL

| SKILL名 | 説明 | トリガータイミング |
|---------|------|-----------------|
| Pre-flight Check | APIと環境の健全性確認 | デプロイ前・E2Eテスト前 |
| Codex Performance Review | CodeXでパフォーマンスレビュー | パフォーマンスに懸念がある変更後 |
| Code Health Check | ファイルサイズ/型重複/ドキュメント乖離を検出 | 定期的または大きなコード変更後 |
| AI Cost Estimator | AIモデルのコスト試算 | モデル変更検討時 |
| Doc Sync Checker | ドキュメントとコードの乖離検出 | ドキュメント更新タイミング |
