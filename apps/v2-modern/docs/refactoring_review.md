**リファクタリング検討（v2-modern）**

作成日: 2026-02-03
作成者: Codex＋GPT-5

**概要**
`apps/v2-modern` は React + Zustand + Vite + Cloudflare Workers 構成で概ね整理されていますが、UI・ドメイン・API 呼び出しが混在している箇所があり、変更影響が広がりやすい状態です。特に `CompletionPage`、`useChat`、`workers/routes` がホットスポットです。

**必要度評価**
- 総合: 中〜高
- 高: ページロジックの肥大、フロント/Workerの共有型の混在
- 中: PDF生成・履歴系ユーティリティの肥大、設定値・フラグの分散
- 低: 小さめのUIコンポーネント群

**主な観察点**
- 画面内に API 呼び出しやサニタイズ、状態遷移が混在
- 1フックが多責務
- Worker 側がフロントの `src` を直接参照
- PDF テンプレートが巨大かつ単一ファイル
- コンテキスト注入と履歴参照ユーティリティが肥大化

**段階的計画（全体）**
1. フェーズ0: 安全網と境界の明確化
2. フェーズ1: 共有スキーマ/型の分離
3. フェーズ2: 完了画面の分解
4. フェーズ3: チャットフローの責務分割
5. フェーズ4: UIレイアウト共通化
6. フェーズ5: Worker の責務整理
7. フェーズ6: PDFテンプレート分割（任意）

**本当に実施すべき優先度高いもの**
1. フェーズ1（共有スキーマ/型の分離）
2. フェーズ2（CompletionPage分解）
3. フェーズ3（useChat責務分割）

**優先度1: 共有スキーマ/型の分離（詳細）**

**目的**
- Worker がフロント `src` に依存している状態を解消し、境界を明確化する
- ビルドや変更影響を局所化する

**新構成（決定事項）**
- 共有配置: `apps/v2-modern/shared`
- 運用形態: 単純TSフォルダ（package化しない）

**移動対象**
- `src/lib/schema.ts` → `shared/schema.ts`
- `src/lib/kySchemas.ts` → `shared/kySchemas.ts`
- `src/types/ky.ts` → `shared/types/ky.ts`

**参照パス変更**
- `@/lib/schema` → `@shared/schema`
- `@/lib/kySchemas` → `@shared/kySchemas`
- `@/types/ky` → `@shared/types/ky`

**tsconfig 変更**
- `tsconfig.json` / `tsconfig.app.json` に `@shared/*` を追加

**影響する公開API/型**
- 変更は import パスのみで、型/スキーマ内容は不変

**テスト計画**
- `npm test`（vitest）
- 重点確認: `tests/unit/schema.test.ts`, `tests/unit/historyUtils.test.ts`, `tests/unit/contextInjection.test.ts`, `tests/unit/kyStore.test.ts`
- Worker 参照から `../../src/*` が消えていることの確認

**受け入れ基準**
- Worker から `src` への参照がゼロ
- 全ユニットテストが成功

**ドキュメント更新（推奨）**
- `docs/30_design/02_機能設計_Phase2_Detail.md` のパス記載修正
- `docs/10_manuals/AI_Response_Time_Optimization.md` のパス記載修正

**効果見込み**
- 変更の影響範囲が局所化され、バグ混入率が下がる
- API/Worker と UI の責務分離でレビュー効率が上がる
- テストが書きやすくなり、回帰検知が強化される
