# システムアーキテクチャ設計書（Phase 2.1-2.5）

**対象**: Voice KY Assistant v2-modern（Phase 2.1-2.5）  
**目的**: 全体構成・責務・データフロー・運用境界を明確化する

---

## 1. 参照資料

- `../00_planning/03_Phase2ロードマップ_Phase2_Roadmap.md`
- `../00_planning/01_品質改善提案_Quality_Improvement.md`
- `../ARCHITECTURE.md`（要約）
- `../TECH_STACK.md`（要約）
- `../00_planning/04_要件定義書_SRS.md`

---

## 2. 全体構成（論理アーキテクチャ）

```mermaid
graph TD
  User[作業員] --> Browser[クライアントUI<br/>(React/Vite)]
  Browser --> Pages[Cloudflare Pages]
  Browser --> Workers[Cloudflare Workers (Hono)]

  Workers --> KV[Workers KV<br/>(Rate Limit/Cache)]
  Workers --> OpenAI[OpenAI API]
  Workers --> Weather[Weather API]
  Workers --> RAG[Context Store<br/>(Supabase/DB)]
  Workers --> Sentry[Sentry/Logs]

  Browser --> Local[Local Store<br/>(IndexedDB)]
  Browser --> PDF[Client PDF]
```

---

## 3. コンポーネント責務

- **クライアントUI**: テキスト主導の入力UI、タグ選択、対話表示、PDF出力
- **Workers API**: ルーティング、認証/Origin検証、レート制限、JSON検証・回復、SSE
- **KV**: レート制限・天候キャッシュ・軽量メタデータ
- **RAGストア**: 過去ヒヤリハット/昨日指摘の検索・取得
- **外部API**: OpenAI推論、天候取得
- **観測基盤**: Sentry/ログ/KPIの収集

---

## 4. 主要データフロー

1. **起動**: Browser → Pages で静的アセット取得
2. **対話**: Browser → Workers → (KV/RAG/Weather/OpenAI) → Browser
3. **ストリーミング**: Workers → SSE で逐次応答
4. **記録**: Browser → Local Store → Workers → DB（同期待ち）
5. **計測**: Browser/Workers → Sentry/Logs/KPI

---

## 5. セキュリティ境界（Phase 2.1）

- Origin Allowlist
- レート制限（KV）
- 入力検証（長さ/禁止語/役割制限）
- APIキーはWorkers内で保持

---

## 6. 非機能設計の要点

- **性能**: SSEで体感速度を改善、TTFT短縮
- **安定性**: JSON破損時の回復・再生成
- **運用**: KPI/ログ/Sentryで可観測性を確保
- **継続性**: AI依存低減のための抽象化をPhase 3で計画

---

## 7. 関連ドキュメント

- `../30_design/02_機能設計_Phase2_Detail.md`
- `../30_design/03_API設計_API_Design.md`
- `../30_design/04_データモデル設計_Data_Model.md`
- `../30_design/05_対話UX設計_Conversation_UX.md`
