# API設計（Phase 2.1-2.5）

**目的**: APIの入力/出力/認証/エラー仕様を統一する

---

## 1. 共通仕様

- Base URL: `https://<worker-domain>`
- Content-Type: `application/json`
- 認証: Origin Allowlist（将来: JWT/Access）
- レート制限: KV（IP/Origin単位）

**共通エラーフォーマット**
```json
{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests"
  }
}
```

---

## 2. エンドポイント

### 2.1 POST /api/chat

**用途**: 対話の進行（非ストリーミング）

**Request**
```json
{
  "sessionId": "uuid",
  "message": "足場から落ちそう",
  "context": {
    "siteName": "現場A",
    "history": [{"role": "assistant", "content": "..."}]
  }
}
```

**Response**
```json
{
  "reply": "それは危険ですね。対策は？",
  "phase": "counter_measure",
  "done": false,
  "data": {
    "hazards": ["墜落"],
    "countermeasures": [],
    "actionGoal": null
  }
}
```

---

### 2.2 POST /api/chat (SSE)

**用途**: ストリーミング応答

- `Accept: text/event-stream` を指定
- 逐次 `event: delta` / `data: {"text": "..."}` を返却

**例**
```
event: delta
data: {"text":"それは"}

event: delta
data: {"text":"危険ですね"}

event: done
data: {"phase":"counter_measure"}
```

---

### 2.3 POST /api/advice

**用途**: KY内容への改善アドバイス

**Response**
```json
{
  "advices": [
    {"type":"good","text":"具体的です"},
    {"type":"tip","text":"指差し確認を"}
  ]
}
```

---

### 2.4 POST /api/records

**用途**: 完了記録の保存

**Request**
```json
{
  "id": "uuid",
  "siteName": "現場A",
  "hazards": ["墜落"],
  "countermeasures": ["安全帯"],
  "actionGoal": "指差し確認",
  "createdAt": "2026-01-26T12:00:00Z"
}
```

---

### 2.5 POST /api/context

**用途**: RAG用コンテキスト取得

**Request**
```json
{
  "siteName": "現場A",
  "date": "2026-01-26",
  "limit": 3
}
```

**Response**
```json
{
  "items": [
    {"summary":"昨日のヒヤリハット", "date":"2026-01-25"}
  ]
}
```

---

### 2.6 POST /api/metrics

**用途**: KPI送信（具体性スコア等）

**Request**
```json
{
  "sessionId": "uuid",
  "metric": "specificity_score",
  "value": 3.5
}
```

---

## 3. ステータスコード

- 200: 成功
- 400: バリデーションエラー
- 401/403: 認証/Originエラー
- 429: レート制限
- 500: サーバー内部エラー

---

## 4. バリデーション要点

- message長の上限
- role制限（assistant/system注入の遮断）
- JSON破損時のリトライ/部分採用

---

## 5. セキュリティ運用

- APIキーはWorkersで保持
- 監査ログにPIIを含めない
