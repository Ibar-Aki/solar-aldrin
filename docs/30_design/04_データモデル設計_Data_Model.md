# データモデル設計（Phase 2.1-2.5）

**目的**: セッション/記録/コンテキストの構造と整合性を定義する

---

## 1. 主要エンティティ

- **Session**: 進行中の対話状態
- **KYRecord**: 完了済みのKY記録
- **Hazard**: 危険項目
- **Countermeasure**: 対策項目
- **ActionGoal**: 指差し呼称などの行動目標
- **ContextItem**: RAGで参照する過去情報
- **Metric**: KPI計測値

---

## 2. Session（進行中）

```json
{
  "sessionId": "uuid",
  "phase": "hazard_main",
  "hazards": ["墜落"],
  "countermeasures": [],
  "actionGoal": null,
  "optional": {
    "siteName": "現場A",
    "weather": "rain",
    "members": ["A","B"]
  }
}
```

**ポイント**
- 重要項目でも **optional許容**（段階的入力）
- JSON破損時は「部分採用 + 再質問」

---

## 3. KYRecord（完了記録）

```json
{
  "id": "uuid",
  "createdAt": "2026-01-26T12:00:00Z",
  "siteName": "現場A",
  "hazards": ["墜落"],
  "countermeasures": ["安全帯"],
  "actionGoal": "指差し確認",
  "meta": {
    "specificityScore": 3.5,
    "templateType": "A"
  }
}
```

---

## 4. ContextItem（RAG参照）

```json
{
  "contextId": "uuid",
  "siteName": "現場A",
  "date": "2026-01-25",
  "summary": "昨日のヒヤリハット",
  "tags": ["墜落","足場"]
}
```

---

## 5. 保存先と同期

- **ローカル**: IndexedDB（pending/synced/failed）
- **サーバー**: Supabase等のDB（計画）
- **同期戦略**: まずローカル保存 → 通信可能時に同期

---

## 6. バリデーション/回復ルール

- hazards/countermeasuresは空配列でも許容
- 文字列は正規化（改行/禁止語）
- JSON破損時は「再生成」または「部分保持」

---

## 7. 将来拡張

- ベクトル検索（RAGの精度向上）
- 組織/現場ごとの権限分離
