# Phase 2.6 API仕様（フィードバック/補足/添削）

- 作成日時: 2026-02-02 00:22
- 作成者: Codex + 0.93.0
- 更新日: 2026-02-02
- 対象資料: Phase2.6_Implementation_Plan.md

---

## 1. 目的

- `/api/feedback` の入力・出力を明確化し、仕様逸脱とUI破綻を防ぐ。
- バリデーション/フォールバック/エラー応答を標準化して、回帰と安全性リスクを抑える。

---

## 2. エンドポイント

- `POST /api/feedback`
  - 目的: KY完了時のフィードバック/補足/添削を一括取得
  - 前提: サーバー側で `sessionId` の所有者検証を行い、保持データを正とする

---

## 3. リクエストスキーマ（案）

- **基本方針**
  - `sessionId` は必須。ユーザー所有確認ができない場合は 403。
  - `extracted` は互換目的の暫定入力。サーバー保持のセッションデータを優先する。
  - 文字数/配列数に上限を持たせ、過大入力を遮断する。

```ts
import { z } from "zod";

export const FeedbackRequestSchema = z.object({
  sessionId: z.string().min(8).max(128),
  context: z
    .object({
      work: z.string().max(200).optional(),
      location: z.string().max(200).optional(),
      weather: z.string().max(100).optional(),
    })
    .optional(),
  extracted: z
    .object({
      risks: z.array(z.string().max(120)).max(20).optional(),
      measures: z.array(z.string().max(120)).max(20).optional(),
      actionGoal: z.string().max(120).optional(),
    })
    .optional(),
}).strict();
```

---

## 4. レスポンススキーマ（案）

- **基本方針**
  - UIは `supplements` が空配列でも成立すること。
  - `polishedGoal` は適切でない場合 `null` を許容。
  - スキーマ不整合時は **安全な定型文 + 空配列 + null** にフォールバック。

```ts
export const FeedbackResponseSchema = z.object({
  praise: z.string().min(1).max(240),
  tip: z.string().min(1).max(240),
  supplements: z
    .array(
      z.object({
        risk: z.string().min(1).max(120),
        measure: z.string().min(1).max(120),
      })
    )
    .max(2),
  polishedGoal: z
    .object({
      original: z.string().min(1).max(120),
      polished: z.string().min(1).max(120),
    })
    .nullable(),
  meta: z
    .object({
      requestId: z.string().min(6).max(64),
      cached: z.boolean().optional(),
      validationFallback: z.boolean().optional(),
    })
    .optional(),
});
```

**フォールバック例**

```json
{
  "praise": "今日のKYは要点が押さえられていて良い取り組みです。",
  "tip": "次回は作業順序の確認を一言添えるとさらに良くなります。",
  "supplements": [],
  "polishedGoal": null,
  "meta": { "validationFallback": true }
}
```

---

## 5. エラー応答仕様

**共通形式**

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "sessionId is required",
    "retriable": false,
    "requestId": "req_abc123"
  }
}
```

**主なコードとHTTPステータス**

- `INVALID_REQUEST` (400): スキーマ不正/必須欠落
- `UNAUTHORIZED` (401): 未認証
- `FORBIDDEN` (403): セッション所有者不一致
- `NOT_FOUND` (404): セッション不存在
- `TIMEOUT` (408): 上流/モデルのタイムアウト
- `RATE_LIMITED` (429): レート制限
- `UPSTREAM_ERROR` (502/503): モデルAPI障害
- `INTERNAL_ERROR` (500): 予期せぬ例外

**UI側の扱い**

- いずれもUIは該当カード非表示（全体は継続表示）。
- `retriable=true` の場合のみ1回リトライ可。

---

## 6. サーバー側処理フロー（概要）

1. `ENABLE_FEEDBACK=0` の場合は 204 で即時終了。
2. 認証/認可（`sessionId`所有者検証）。失敗は 403。
3. セッション保有データを取得。必要に応じて `extracted` は無視/補完。
4. 1回のモデル呼び出しで `praise/tip/supplements/polishedGoal` を生成。
5. スキーマ検証 → 失敗時はフォールバック。
6. 近似重複除外（補足）/長さ制約（添削）を適用。
7. 200で返却。

---

## 7. タイムアウト/リトライ/キャッシュ

- サーバータイムアウト: 6秒（超過時は `TIMEOUT`）。
- リトライ: 1回まで（`retriable=true` の場合のみ）。
- キャッシュ: `sessionId` 単位で短時間（例: 5分）キャッシュ。

---

## 8. テスト観点（最小）

- 不正 `sessionId` → 403
- スキーマ不正 → 400
- 出力不正 → フォールバック + 200
- `supplements=[]` → UIが非表示で崩れない
- `polishedGoal=null` → 目標カードが非表示
- タイムアウト → 408 + UI非表示
