# 回答時間短縮・エラー率低減 改善設計レポート（品質維持）

- 作成日時: 2026-02-11T13:41:39+09:00
- 作成者: Codex＋GPT-5
- 更新日: 2026-02-11
- 更新日: 2026-02-11（A/B実装反映）
- 更新日: 2026-02-11（危険2件完了後の「KY完了」自動完了導線を追記）

## 1. 目的

- 現在のアプリ実装と実測データを前提に、以下を同時に達成する設計案を整理する。
  - 回答時間の短縮（特に長い待ちの削減）
  - エラー率の低減（AI系エラーの抑制）
  - 回答品質の維持（自然さ/妥当性の過度な劣化を回避）

## 2. 現状サマリ（2026-02-11時点）

### 2.1 実測指標（抜粋）

出典:
- `apps/v2-modern/reports/perf/daily-summary-2026-02-11.md`
- `apps/v2-modern/reports/real-cost/LIVE/real-cost-LIVE-2026-02-11T03-55-35-352Z.md`

| 指標 | 現状値 | 読み取り |
|---|---:|---|
| 応答時間 P50 (LIVEのみ) | 5.9s | 日常体感は中程度 |
| 応答時間 P95 (LIVEのみ) | 9.9s | 長尾遅延が顕著 |
| JSONパース再試行率 (LIVEのみ) | 55.6% | 出力不安定が高頻度 |
| 待機 > 15s 発生率 (LIVEのみ) | 44.4% | UX劣化が高頻度 |
| エラー率 (LIVEのみ) | 44.4% | 認証/遷移失敗も混在し、AI原因と混同される |
| 最新PASS試験 Avg AI Response | 8.1s | 目標<5sに未達 |
| 最新PASS試験 Parse Retry Used | 3 | 回復できるが遅延コストが高い |

### 2.2 実装構造（遅延・失敗の主因）

出典:
- `apps/v2-modern/workers/routes/chat.ts`
- `apps/v2-modern/workers/lib/openai.ts`
- `apps/v2-modern/src/hooks/useChat.ts`

- サーバー側は `response_format: { type: 'json_object' }` で応答取得し、JSON破損時に「修復呼び出し→再生成呼び出し」を行う。
- OpenAI呼び出し層は 429/5xx/ネットワーク系で内部リトライ（既定2回）を実施する。
- クライアント側は条件一致時にサイレントリトライ（最大2回）を行う。

理論上の最大試行回数（1ユーザー送信あたり）:
- クライアント再送 3回（初回+サイレント2回）
- 各送信で OpenAI 呼び出し 3回（初回+修復+再生成）
- 各 OpenAI 呼び出しで HTTP 試行 3回（初回+内部リトライ2回）
- 合計で最大 27 HTTP 試行相当（3x3x3）

上記は上限値だが、実測でも「ParseRetry attempted: yes」が多く、長尾遅延の主因になっている。

## 3. 改善候補の比較（本質性・難度・工数・効果）

評価基準:
- 本質改善: 根本原因（多段再試行・出力不安定・過大コンテキスト）を直接減らすか
- 実装難度: 低 / 中 / 高
- 効果の大きさ: 大 / 中 / 小（回答時間・エラー率への寄与）

| ID | 改善案 | 本質改善 | 実装難度 | 推定作業時間 | 効果（回答時間） | 効果（エラー率） | 品質リスク | 優先度 |
|---|---|---|---|---:|---|---|---|---|
| A | `json_object`→`json_schema`(`strict: true`) へ移行 | ◎ | 中 | 3-5時間 | 大（再生成減） | 大（JSON破損減） | 中（厳格化で一部応答が硬くなる） | 最優先 |
| B | リトライ予算の一本化（サーバー主導、クライアントサイレント縮小） | ◎ | 中 | 3-4時間 | 大（掛け算遅延を削減） | 中 | 低 | 最優先 |
| C | タイムアウト二段化（soft/hard）+ フォールバック応答 | ○ | 中 | 2-4時間 | 中〜大（P95短縮） | 中 | 低 | 高 |
| D | ストリーミング導入（体感時間短縮） | △ | 中 | 3-5時間 | 体感は大 / 実時間は中 | 小 | 中（部分出力の扱い） | 高 |
| E | 履歴・要約・contextInjectionのトークン予算再設計 | ○ | 中 | 2-4時間 | 中 | 小〜中 | 中（情報欠落） | 中 |
| F | エラー分類の再定義（AI系/認証/遷移を分離） | ○ | 低 | 1-2時間 | 小（直接短縮は限定） | 大（正しい改善が可能） | 低 | 高 |
| G | モデル/サービスティアの最適化試験 | △ | 中 | 2-3時間 | 中 | 小 | 中（コスト増） | 中 |

## 4. 推奨実施順

### Implementation Plan

推定作業時間: 約17時間

前提:
- 現行テストが通ること
- OpenAI APIキー/本番認証設定が有効であること

1. フェーズ1: 出力契約の厳格化（A）  
   推定: 3-5時間  
   成果: JSON修復の発生率を下げる。`Parse Retry Used` の即時低減を狙う。

2. フェーズ2: リトライ予算の再設計（B）  
   推定: 3-4時間  
   成果: 多段リトライの掛け算構造を解消し、P95とタイムアウト率を下げる。

3. フェーズ3: タイムアウト/フォールバック整備（C）  
   推定: 2-4時間  
   成果: 15秒超の待ちを上限管理し、長時間ブロックを回避する。

4. フェーズ4: ストリーミング導入（D）  
   推定: 3-5時間  
   成果: 初回表示までの時間を短縮し、体感速度を改善する。

5. フェーズ5: 計測再定義と運用判定（F + E/Gの一部）  
   推定: 2-3時間  
   成果: AI品質・性能の評価指標を誤差なく運用できる状態にする。

## 5. 成果判定KPI（品質ガード付き）

2週間目安:
- 応答時間 P50: 5.9s → 4.0s以下
- 応答時間 P95: 9.9s → 7.5s以下
- `Parse Retry Used` 率: 55.6% → 5%以下
- `Wait > 15s` 発生率: 44.4% → 10%以下
- AI系エラー率（認証/遷移を除外）: 2%以下

品質ガード（維持条件）:
- 既存シナリオで完了率を維持（`Nav Success` 低下なし）
- 重要出力（危険要因・対策抽出）の妥当性を回帰試験で確認
- 回答品質が低下した施策は即ロールバック可能なフラグ設計で実装

## 6. 推奨アクション（最短で効く順）

1. A+Bを先行実装し、`Parse Retry Used` と P95 を重点観測する
2. 目標未達なら C を追加して長尾を抑える
3. UX要求が強い場合に D を追加し、体感速度を底上げする
4. E/F/G は運用最適化として段階投入する

## 7. 根拠資料

ローカル実装・レポート:
- `apps/v2-modern/workers/routes/chat.ts`
- `apps/v2-modern/workers/lib/openai.ts`
- `apps/v2-modern/src/hooks/useChat.ts`
- `apps/v2-modern/reports/perf/daily-summary-2026-02-11.md`
- `apps/v2-modern/reports/real-cost/LIVE/real-cost-LIVE-2026-02-11T03-55-35-352Z.md`

OpenAI公式ドキュメント:
- `response_format` で `json_schema` が推奨、`json_object` は旧方式  
  https://platform.openai.com/docs/api-reference/chat/create#chat_create-response_format
- Latency Optimization（Seven principles）  
  https://platform.openai.com/docs/guides/latency-optimization#seven-principles
- Streaming API responses  
  https://platform.openai.com/docs/guides/streaming-responses
- Prompt caching（先頭に再利用コンテンツを寄せる）  
  https://platform.openai.com/docs/guides/prompt-engineering#save-on-cost-and-latency-with-prompt-caching

## 8. 実装反映メモ（2026-02-11）

- A（`json_object` → `json_schema strict`）を実装。
  - 変更: `apps/v2-modern/workers/routes/chat.ts`
  - 内容: `response_format` を `json_schema` + `strict: true` に移行し、JSON修復/再生成の追加呼び出しを廃止。
- B（リトライ予算の一本化）を実装。
  - 変更: `apps/v2-modern/workers/routes/chat.ts`, `apps/v2-modern/src/hooks/useChat.ts`
  - 内容: サーバー側に `OPENAI_RETRY_COUNT`（既定1、0〜2）を導入。クライアント側サイレントリトライは `VITE_ENABLE_RETRY_SILENT=1` のときのみ有効、最大1回に縮小。
- UIUX補強（完了導線）を実装。
  - 変更: `apps/v2-modern/src/hooks/useChat.ts`, `apps/v2-modern/src/pages/KYSessionPage.tsx`
  - 内容: 危険2件が保存済みの状態で「KY完了」を受けた場合、API呼び出し無しで `status=completed` とし、完了画面（`/complete`）へ自動遷移。
