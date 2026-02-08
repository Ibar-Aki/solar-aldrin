# 0: KYフィードバック品質向上 検討レポート（v2-modern）

- 作成日時: 2026-02-06 23:31:11 +09:00
- 作成者: Codex＋GPT-5
- 対象: 完了画面の事後フィードバック（`workers/routes/feedback.ts`）
- 検討前提: 品質最優先（コスト・遅延は許容範囲で管理）
- 本レポート作成見積: 2.5時間

## 1. 背景と現状

現状の実装は以下です。

- モデル: `gpt-4o-mini`
- API: Chat Completions (`/v1/chat/completions`)
- 応答形式: `response_format: { type: "json_object" }`
- 安全策: Zod検証、補足重複除去、フォールバック文面、KVキャッシュ
- 課題: 品質評価の定量指標が薄く、モデル変更時の比較基盤が不足

## 2. 解決したい課題

- 褒め・改善ヒントの具体性にばらつきがある
- 現場文脈に合わない補足リスクが出る場合がある
- モデルやプロンプトの変更が、品質改善なのか回帰なのか判定しづらい

## 3. 選択肢比較

| 案 | 内容 | 品質 | コスト | 実装難易度 | 備考 |
| --- | --- | --- | --- | --- | --- |
| A | 既存 `gpt-4o-mini` 維持 + プロンプト強化 + 検証強化 | 中 | 低 | 低 | 最短で着手可能 |
| B | `gpt-5.2` / `gpt-5-mini` へ移行（Responses API優先） | 高 | 中〜高 | 中 | 品質上限が最も高い |
| C | 2段階生成（生成→自己評価/再生成） | 最高 | 高 | 高 | 遅延増・運用複雑化 |

## 4. 推奨案

**推奨: B（段階導入）**

- Step 1: 評価基盤整備（現行モデルのまま）
- Step 2: `feedback` ルートのみ `gpt-5.2` 系に切替
- Step 3: 品質とコストを見て `gpt-5-mini` とのAB比較で最終確定

採用理由:

- 品質最優先の方針に合致
- 影響範囲を `feedback` API に限定でき、チャット本体への回帰リスクを抑制
- Responses APIへ寄せることで、今後のモデル更新追従がしやすい

## 5. 変更仕様（UI/API/型/運用）

### 5.1 API・サーバー

- `workers/routes/feedback.ts`
  - モデル名を環境変数化（例: `OPENAI_FEEDBACK_MODEL`）
  - 将来的な Responses API対応を見据えて、OpenAI呼び出し層を抽象化
- `workers/lib/openai.ts`
  - Chat Completions専用から、`chat|responses` を切り替え可能な関数設計へ拡張

### 5.2 評価運用

- オフライン評価用セット（30〜50ケース）を固定化
- 指標を追加
  - praise具体性スコア
  - tip実行可能性スコア
  - supplements妥当率
  - フォールバック発生率

### 5.3 画面

- `src/pages/CompletionPage.tsx`
  - 必須変更は最小
  - 将来のA/B表示切替用に `meta.variant` の受け口を持たせる

## 6. 実装工数概算

| 作業 | 工数（人日） | 内容 |
| --- | --- | --- |
| 評価セット整備 | 1.5 | ケース作成、採点観点定義 |
| OpenAI呼び出し抽象化 | 1.5 | `workers/lib/openai.ts` 拡張 |
| feedbackルート改修 | 1.5 | モデル切替、エラー処理調整 |
| 計測・ログ追加 | 1.0 | 指標収集、メタ付与 |
| テスト更新 | 1.5 | unit/integration |
| 合計 | **7.0人日** |  |

最小スコープ（A寄り）なら **3.5〜4.0人日**。

## 7. テスト観点

- 正常系: schema準拠、補足最大2件、目標添削条件の維持
- 異常系: OpenAI timeout/5xx/429、JSON破損、検証失敗
- 品質系: 固定ケースで旧新モデル比較（同一入力・同一採点）

## 8. リスクと対策

- リスク: 新モデルで文体が変わり、現場の受容性が下がる
  - 対策: 既存文体をガードする評価項目を導入
- リスク: コスト増
  - 対策: `feedback` ルートのみ先行切替 + キャッシュ維持
- リスク: レイテンシ増
  - 対策: timeout・fallbackを現行より厳密化

## 9. 受け入れ基準

- 既存必須仕様（JSON形式、補足上限、PII禁止）が維持される
- 評価セットで基準比 +15%以上の品質改善（定義済みスコア）
- エラー率・フォールバック率が現行同等以下

## 10. 公式参照

- Latest model guidance: https://platform.openai.com/docs/guides/latest-model
- Responses API migration: https://platform.openai.com/docs/guides/responses-vs-chat-completions
- Text to Speech（品質比較の補助参照）: https://platform.openai.com/docs/guides/text-to-speech
