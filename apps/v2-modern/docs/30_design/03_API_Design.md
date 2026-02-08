# API設計（v2-modern）

**目的**: APIの入力/出力/認証/エラー仕様を現状コードに合わせて定義する  
**更新日**: 2026-02-06

---

## 1. 共通仕様

- Base URL: `/api`（Cloudflare Workers）
- Content-Type: `application/json`
- CORS: Allowlist Origin のみ許可
- レート制限: 1分あたり30回（KV使用）
- 認証: 本番は Bearer 必須（`API_TOKEN` 必須）。`REQUIRE_API_TOKEN` で強制可否を明示指定可能

**認証の例**
```
Authorization: Bearer <API_TOKEN>
```

---

## 2. エンドポイント一覧

### 2.1 GET /api/health

**用途**: ヘルスチェック

**Response**
```json
{
  "status": "ok",
  "version": "v2"
}
```

**curl例**
```bash
curl -i "<BASE_URL>/api/health" \
  -H "Origin: https://your-allowed-origin.example"
```

---

### 2.2 POST /api/chat

**用途**: 対話の進行（非ストリーミング）

**Request**
```json
{
  "messages": [
    { "role": "user", "content": "配管の溶接作業を行います" },
    { "role": "assistant", "content": "どんな危険が潜んでいますか？" }
  ],
  "sessionContext": {
    "userName": "田中",
    "siteName": "現場A",
    "weather": "晴れ",
    "workItemCount": 1,
    "processPhase": "組み立て",
    "healthCondition": "good"
  },
  "contextInjection": "..."
}
```

**Response（成功）**
```json
{
  "reply": "それは危険ですね。どのような状況で起きますか？",
  "extracted": {
    "nextAction": "ask_why"
  },
  "usage": {
    "totalTokens": 1234
  }
}
```

**3.8 レスポンス簡素化ルール（2026-02-06反映）**
- `reply` は必須
- `extracted.nextAction` は必須
- `workDescription` / `hazardDescription` / `whyDangerous` / `countermeasures` / `riskLevel` / `actionGoal` は判明時のみ返却
- `null` / 空文字 / 空配列は返却前に除去する
- 互換性維持のため、`extracted` と `usage.totalTokens` はレスポンスに残す

**curl例**
```bash
curl -X POST "<BASE_URL>/api/chat" \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-allowed-origin.example" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{
    "messages": [
      { "role": "user", "content": "配管の溶接作業を行います" }
    ],
    "sessionContext": {
      "userName": "田中",
      "siteName": "現場A",
      "weather": "晴れ",
      "workItemCount": 1
    }
  }'
```

**Response（エラー例）**
```json
{
  "error": "AI応答の取得に失敗しました"
}
```

---

### 2.3 POST /api/feedback

**用途**: 完了後のフィードバック生成

**Request**
```json
{
  "sessionId": "uuid",
  "clientId": "uuid",
  "context": {
    "work": "配管溶接",
    "location": "現場A",
    "weather": "晴れ",
    "processPhase": "組み立て",
    "healthCondition": "good"
  },
  "extracted": {
    "risks": ["火花による引火"],
    "measures": ["消火器配置"],
    "actionGoal": "火気使用時の完全養生よし"
  },
  "chatDigest": "U: ...\nA: ..."
}
```

**curl例**
```bash
curl -X POST "<BASE_URL>/api/feedback" \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-allowed-origin.example" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -d '{
    "sessionId": "uuid",
    "clientId": "uuid",
    "context": {
      "work": "配管溶接",
      "location": "現場A",
      "weather": "晴れ"
    },
    "extracted": {
      "risks": ["火花による引火"],
      "measures": ["消火器配置"],
      "actionGoal": "火気使用時の完全養生よし"
    }
  }'
```

**Response（成功）**
```json
{
  "praise": "要点が押さえられています",
  "tip": "次回は作業順序も一言添えましょう",
  "supplements": [
    { "risk": "火花の飛散", "measure": "周囲の養生" }
  ],
  "polishedGoal": {
    "original": "火気使用時の完全養生よし",
    "polished": "火気使用時は完全養生ヨシ"
  },
  "meta": {
    "requestId": "req_...",
    "cached": false
  }
}
```

**Response（キャッシュヒット例）**
```json
{
  "praise": "要点が押さえられています",
  "tip": "次回は作業順序も一言添えましょう",
  "supplements": [],
  "polishedGoal": null,
  "meta": {
    "requestId": "req_...",
    "cached": true
  }
}
```

**Response（無効化時）**
- `ENABLE_FEEDBACK=0` の場合は `204 No Content`

**Response（エラー例）**
```json
{
  "error": {
    "code": "TIMEOUT",
    "message": "AI応答がタイムアウトしました",
    "retriable": true,
    "requestId": "req_..."
  }
}
```

---

### 2.4 POST /api/metrics

**用途**: KPI送信
**認証**: Bearer 必須（他APIと同等）

**Request**
```json
{
  "event": "session_start",
  "timestamp": "2026-02-03T12:00:00Z",
  "sessionId": "uuid",
  "value": 1234,
  "data": {
    "workItemCount": 2,
    "hadNearMiss": false
  }
}
```

**Response**
```json
{
  "ok": true
}
```

**curl例**
```bash
curl -X POST "<BASE_URL>/api/metrics" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Origin: https://your-allowed-origin.example" \
  -d '{
    "event": "session_start",
    "timestamp": "2026-02-03T12:00:00Z",
    "sessionId": "uuid",
    "value": 1234,
    "data": { "workItemCount": 2 }
  }'
```

---

## 3. ステータスコード

- 200: 成功
- 204: フィードバック無効時
- 400: バリデーションエラー
- 401: 認証エラー
- 403: Origin拒否
- 408: フィードバックのタイムアウト
- 429: レート制限
- 500: サーバー内部エラー
- 504: チャット応答タイムアウト

---

## 4. バリデーション要点

- `messages` は user/assistant のみ許可
- `content` は制御文字と最大長をチェック
- `contextInjection` は最大長制限
- フィードバックは schema 不一致時にフォールバック応答

---

## 5. 代表的なエラー例

**401 認証エラー（API_TOKEN不一致）**
```json
{
  "error": "Unauthorized"
}
```

**403 Origin拒否**
```json
{
  "error": "Origin is not allowed"
}
```

**429 レート制限**
```json
{
  "error": "Too many requests"
}
```

**408 フィードバックタイムアウト**
```json
{
  "error": {
    "code": "TIMEOUT",
    "message": "AI応答がタイムアウトしました",
    "retriable": true,
    "requestId": "req_..."
  }
}
```

**504 チャットタイムアウト（retriable）**
```json
{
  "error": "AI応答がタイムアウトしました",
  "retriable": true
}
```

---

## 6. D1バッチ化設計（3.5 / 設計確定）

**ステータス**: 設計完了（実装は次フェーズ）

### 6.1 目的
- `feedback` 系の複数書き込みを `DB.batch(...)` へ集約し、保存処理の整合性と負荷効率を高める

### 6.2 想定テーブル
- `feedback_sessions`
  - `session_id` (PK), `client_id`, `payload_json`, `created_at`
- `feedback_cache`
  - `session_id` (PK), `client_id`, `response_json`, `cached_at`, `expires_at`
- `feedback_events`
  - `id` (PK), `session_id`, `event_type`, `event_payload_json`, `created_at`

### 6.3 書き込み方針
- `POST /api/feedback` で保存が必要な場合、以下を1回の `batch` で実行
  - セッション初回保存（upsert）
  - キャッシュ保存（upsert）
  - 監査/分析イベント保存（insert）
- 途中失敗時は全体失敗として扱い、部分更新を残さない

### 6.4 エラー方針（予定）
- D1書き込み失敗: `500` + `DB_WRITE_FAILED`
- D1タイムアウト: `503` + `DB_TIMEOUT`（`retriable: true`）

### 6.5 移行手順（予定）
1. D1スキーマ作成とマイグレーション適用
2. 読み取り互換層（既存KV + D1）を追加
3. 書き込みをD1バッチへ段階切替
4. KV依存を縮小し、運用確認後に整理
