# DLG-03 & DLG-04 実装タスクリスト

## 計画フェーズ

- [x] コードベース調査（既存の対話ロジック、フックの確認）
- [x] 実装計画の作成（日本語化対応）
- [x] 実装計画の自己レビュー
- [x] 実装懸念事項のドキュメント化

## 実装フェーズ: DLG-03 & DLG-04

- [x] システムプロンプトの実装 (soloKY.ts)
- [x] レビュー指摘事項の修正 (#1-3, #7-9)
- [x] コミット完了

## 検証フェーズ: Live API Test

- [x] `tests/e2e/live-ai-chat.spec.ts` の作成
- [x] `package.json` に `test:live` スクリプト追加
- [x] 実費を使用したテスト実行 (1回)

## 検証フェーズ: Real-Cost Test (Full Scenario)

- [x] `tests/e2e/real-cost-scenario.spec.ts` の作成
  - レポート生成機能の実装
  - 人間らしい入力遅延 (delay) の実装
- [x] `package.json` に `test:cost` スクリプト追加
- [x] 実費テスト実行 (最大3回)
  - 3回中3回ともシナリオ通過（一部ブラウザでタイムアウトあり）
  - AIのループ現象、一時エラーからの復帰を確認
- [x] AI応答のJSONパース処理を堅牢化（Markdown除去ロジック追加）

## フェーズ 2b: 実費テスト高度化と自律改善

- [x] **評価指標(Metrics)の導入**
  - Reliability: 完遂率、エラーレスポンス数（実装済み）
  - Performance: AI応答時間、シナリオ所要時間（実装済み）
  - Quality: 会話ターン数（ループ検知）（実装済み）
- [x] `tests/e2e/real-cost-scenario.spec.ts` の改修
  - タイムアウト対策（完了遷移の待機ロジック改善）
  - メトリクス計測とレポート出力の強化 (ESM化対応)
- [x] 自律改善ループ実行 (Run 1-3 -> Debug attempts)
  - Result: テストスクリプトの堅牢化完了

## フェーズ 2c: Dry Run 安定化とドキュメント化

- [x] Dry Run (Mock Mode) の完全動作確認
  - セレクタの堅牢化 (`data-testid`)
  - モッドレスポンスの整合性確保 (`extracted` データの追加)
  - `npm run test:cost` (Dry Run) で PASS を確認
- [x] 全テストの棚卸しとドキュメント化 (`phase2_test_inventory.md`)

## フェーズ 2d: 品質・安全性強化 (Hardening Phase)

- [x] 入力長制約の一本化 (Schema export -> Client import)
- [x] Worker側レスポンス検証 (Zod safeParse & Error Handling)
- [x] Client側レスポンス検証 (API response type guard)
- [x] 認証設定不足の早期検知 (`VITE_REQUIRE_API_TOKEN` check)
- [x] PDF Debug機能の安全性回復 (Canvas context null check)
- [x] 定数の完全統一 (Worker `MAX_TOTAL_INPUT_LENGTH` refactor)

## Phase 2.6: 事後フィードバック・補強 (Implemented)

- [x] 機能要件定義・取捨選択 (Decision Matrix)
- [x] 実装計画策定 (Implementation Plan)
- [x] バックエンド実装 (Single-Prompt Architecture)
  - [x] `workers/routes/feedback.ts`
  - [x] `workers/prompts/feedbackKY.ts`
- [x] フロントエンド実装
  - [x] `FeedbackCard.tsx` (ADV-01)
  - [x] `SupplementCard.tsx` (ADV-02)
  - [x] `GoalPolishCard.tsx` (ADV-04)
  - [x] `CompletionPage.tsx` 統合

## Phase 2.6b: リファクタリング & 追加検証 (Implemented)

- [x] バックエンド共通化 (`workers/lib/openai.ts`)
- [x] 影響範囲テスト (`npm test`)
- [x] Evolved Real Cost Test (Feedback/Supplement検証)

## Phase 2.7: コンテキスト注入・循環 (Verified / Complete)

- [x] 機能要件定義 (Decision Matrix)
- [x] 実装計画策定 (Implementation Plan - Refined)
- [x] 履歴取得ユーティリティ実装 (CTX-01) (`src/lib/historyUtils.ts`)
- [x] プロンプト注入ロジック実装 (`src/hooks/useChat.ts`, `workers/routes/chat.ts`)
- [x] 天候・曜日コンテキスト実装 (CTX-04) (`src/lib/contextUtils.ts`)
- [x] コンテキスト注入のE2E検証 (Verification) (`tests/unit/historyUtils.test.ts`, `contextInjection.test.ts`)
