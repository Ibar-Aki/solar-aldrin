# Phase 2.11 Dual API 実装計画（OpenAI / Gemini A/Bテスト）

作成日時: 2026-02-11 17:47:10 +09:00  
作成者: Codex+GPT-5  
更新日: 2026-02-11

推定作業時間: 約8時間

## 1. 方針（現行実装準拠）

- 既存の `workers/lib/openai.ts` と `workers/routes/chat.ts` を活かし、**段階的にマルチプロバイダ化**します。
- 初期実装は **Gemini OpenAI互換エンドポイント**を採用し、導入差分とリスクを最小化します。
- クライアントからの指定は `ChatRequest` に `provider` を追加して行い、初期版ではカスタムHTTPヘッダー依存を避けます。

## 2. 対象ファイル（予定）

- `apps/v2-modern/src/lib/schema.ts`
- `apps/v2-modern/src/lib/api.ts`
- `apps/v2-modern/src/hooks/useChat.ts`
- `apps/v2-modern/src/pages/HomePage.tsx`（テスト用切替UI）
- `apps/v2-modern/workers/lib/openai.ts`（共通LLMクライアント化）
- `apps/v2-modern/workers/routes/chat.ts`
- `apps/v2-modern/workers/index.ts`
- `apps/v2-modern/.dev.vars.example`
- `apps/v2-modern/tests/unit/*`（API/設定保存まわり）
- `apps/v2-modern/tests/integration/*`（chat route分岐）
- `apps/v2-modern/tests/e2e/*`（A/Bの最小シナリオ）

## 3. 実装ステップ

1. 現状固定とFeature Flag導入（推定: 30-60分、前提: 既存テストがローカルで通る）
   - `provider` 未指定時は必ず `openai` を使う既定値を定義。
   - `ENABLE_GEMINI_PROVIDER` フラグを Workers 側に追加（デフォルトOFF）。
2. リクエストスキーマ拡張（推定: 30-60分）
   - `ChatRequestSchema` に `provider: 'openai' | 'gemini'`（optional）を追加。
   - クライアント型とバリデーションを同期。
3. WorkersのProvider抽象化（推定: 90-150分）
   - 既存 OpenAI 呼び出しを provider 指定可能な共通実装へ整理。
   - Gemini用エンドポイント/キー/モデルの分岐を追加。
4. Gemini接続（OpenAI互換）とレスポンス正規化（推定: 60-90分）
   - `baseURL` を provider ごとに切替。
   - JSON schema 失敗時の既存エラーコード（`AI_RESPONSE_INVALID_JSON` 等）へ統一。
5. フロント切替UIと永続化（推定: 60-90分）
   - `HomePage` にテスト用 `AI Provider` 選択UIを追加（Feature Flag有効時のみ表示）。
   - `localStorage` に選択状態を保存し、`postChat` に `provider` を付与。
6. 観測性の追加（推定: 30-60分）
   - ログに `provider` / `model` / `durationMs` / `status` を付与。
   - `/api/metrics` に provider 次元の集計を追加。
7. テスト拡充（推定: 90-150分）
   - unit: スキーマ、localStorage、APIリクエストペイロード。
   - integration: `provider=openai/gemini` 分岐、無効provider拒否、flag OFF時の拒否。
   - e2e: A/B最小シナリオ（1往復以上）を追加。
8. iPhone実機検証と記録（推定: 30-60分）
   - OpenAI/Gemini 各3シナリオで応答時間・エラー率・体感コメントを収集。
   - 結果を `docs/50_reviews` 配下へ記録。

## 4. 受け入れ基準（DoD）

- `provider` 未指定時に既存挙動（OpenAI）が完全維持される。
- `provider=gemini` で `reply` / `extracted` のスキーマが通る。
- 既存テスト + 追加テストが全て通る。
- iPhone実機で OpenAI/Gemini のA/Bが再現可能。
- ログから provider 別の失敗率・応答時間を確認できる。

## 5. ロールバック方針

- Feature Flag をOFFにすれば `openai` 固定へ即時復帰可能にする。
- 問題発生時は UI 側 provider 選択を非表示化し、サーバー側で `provider=openai` に強制フォールバックする。

## 6. 補足（技術選定の理由）

- OpenAI公式では新規開発に Responses API 推奨が明記されていますが、現行コードは Chat Completions 前提です。  
  初回は差分最小のまま dual-provider を成立させ、後続で Responses API への移行を独立タスク化する方が安全です。
- OpenAI Structured Outputs を使っているため、Gemini側でも同等保証が取れないケースを想定し、サーバー側で必ず再検証します。

