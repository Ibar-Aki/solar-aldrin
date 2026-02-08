# Phase 2 Test Inventory

**Status**: Verified
**Updated**: 2026-02-03

## 1. Unit Tests (`tests/unit`)

| File | Purpose | Key Cases | Status |
| :--- | :--- | :--- | :--- |
| `historyUtils.test.ts` | 履歴管理ロジックの検証 | 類似度フィルタ(CTX-01)<br>保持ポリシー(Retention)<br>ヒヤリハット取得 | ✅ PASS |
| `contextInjection.test.ts` | コンテキスト注入ロジック検証 | 昨日の危険強調(CTX-02)<br>天候・曜日推奨(CTX-04)<br>プロンプト生成 | ✅ PASS |
| `useChat.test.ts` (Mock) | Chat Hookの動作検証 | 送信状態管理<br>JSONパース<br>エラーハンドリング | ✅ PASS |
| `openai.test.ts` | OpenAI API呼び出し共通化 | APIキー管理<br>リクエスト構築<br>レスポンス型定義 | ✅ PASS |

## 2. Integration Tests (`tests/integration` or `workers`)

| File | Purpose | Key Cases | Status |
| :--- | :--- | :--- | :--- |
| `chat.ts` (Worker Route) | バックエンド統合テスト | Context Injection結合<br>System Prompt構築<br>OpenAI Mock応答 | ✅ PASS |

## 3. E2E Tests (`tests/e2e`)

| File | Purpose | Key Cases | Status |
| :--- | :--- | :--- | :--- |
| `real-cost-scenario.spec.ts` | **全機能統合シナリオ (Real API)** | 正常系対話完遂<br>JSON修復・再試行<br>PDF生成・ダウンロード<br>完了ページ表示 | ✅ PASS |
| `live-ai-chat.spec.ts` | AI応答品質スモーク | 基本的な対話成立<br>応答速度計測 | ✅ PASS |
| `dry-run.spec.ts` | コストなし動作確認 (Mock) | UI遷移確認<br>バリデーション動作<br>エラー表示 | ✅ PASS |

## 4. Manual Verification

| Feature | Verification Steps | Result |
| :--- | :--- | :--- |
| **History Retention** | 100件以上のデータ投入後、古いデータが消えるか確認 | ✅ OK (Unit Test Verified) |
| **Weather/Date** | 天候選択UIが表示され、プロンプトに反映されるか | ✅ OK (Unit Test Verified) |
| **Feedback UI** | 完了画面で「アドバイス」と「補足」が表示されるか | ✅ OK (E2E Verified) |
