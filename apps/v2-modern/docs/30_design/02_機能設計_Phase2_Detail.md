# 機能設計（Phase 2.1-2.8 詳細）

**目的**: 各フェーズの機能要件を、現状コードに合わせて実装可能な粒度で整理する  
**更新日**: 2026-02-03

---

## Phase 2.1 運用防御とコスト制御

**目的**
- 公開APIの濫用防止とコスト暴騰リスクの最小化

**実装ポイント**
- Origin Allowlist によるアクセス制限
- レート制限（1分あたり30回）
- Bearer トークン認証（環境変数 `API_TOKEN` がある場合のみ有効）
- リクエスト/レスポンスのZod検証

**主な実装場所**
- `workers/index.ts`
- `workers/middleware/rateLimit.ts`
- `src/lib/schema.ts`

**完了条件**
- 許可外Originは 403 になる
- API_TOKEN 設定時に不正トークンが 401 になる
- 連続アクセスで 429 が発生する

---

## Phase 2.2 会話・データ安定化（テキスト主導）

**目的**
- 騒音/端末制約下でも成立する入力体験を保証
- JSON破損や未入力でセッションが破綻しない

**実装ポイント**
- テキスト入力主体のUI
- JSONパース失敗時のフォールバック応答
- 未確定項目を許容するデータモデル

**主な実装場所**
- `src/components/ChatInput.tsx`
- `workers/lib/openai.ts`
- `src/types/ky.ts`

**完了条件**
- AIのJSONが壊れても画面が停止しない
- 入力未完でも会話継続できる

---

## Phase 2.3 履歴管理（History）

**目的**
- 完了セッションの保存と履歴参照を実現

**実装ポイント**
- IndexedDB（Dexie）に保存
- 最大100件・90日保持のローテーション
- 履歴一覧・詳細の参照

**主な実装場所**
- `src/lib/db.ts`
- `src/lib/historyUtils.ts`
- `src/pages/HistoryPage.tsx`
- `src/pages/HistoryDetailPage.tsx`

**完了条件**
- 完了セッションが履歴に残る
- 古い履歴が自動削除される

---

## Phase 2.4 対話品質の向上

**目的**
- 具体性と自己決定感を両立し、形骸化を防止

**実装ポイント**
- 4フェーズの厳格な質問順序
- 質問テンプレのローテーション
- 「なぜ」を避けた聞き方
- 先行回答（対策/目標）を受けても順序に戻す

**主な実装場所**
- `workers/prompts/soloKY.ts`
- `src/hooks/useChat.ts`

**完了条件**
- 4フェーズの順序が崩れない
- 重要危険と対策の深掘りが安定する

---

## Phase 2.5 体験速度・信頼性・可観測性

**目的**
- 体感速度と運用品質の改善

**実装ポイント**
- `/api/metrics` にイベント送信
- エラー時の再試行導線
- KPIのログ集計

**主な実装場所**
- `src/lib/observability/telemetry.ts`
- `workers/routes/metrics.ts`
- `workers/observability/logger.ts`

**完了条件**
- セッション開始/完了/入力長が計測できる
- 重大エラーがログに残る

---

## Phase 2.6 事後フィードバック

**目的**
- KY完了後に短いフィードバックを返す

**実装ポイント**
- `/api/feedback` で評価と補足を生成
- KVキャッシュとセッション保護
- 204 の場合はフィードバック非表示

**主な実装場所**
- `workers/routes/feedback.ts`
- `workers/prompts/feedbackKY.ts`
- `src/pages/CompletionPage.tsx`

**完了条件**
- フィードバックカードが表示される
- 無効時は 204 で安全にスキップ

---

## Phase 2.7 コンテキスト注入（ナレッジ循環）

**目的**
- 「毎回同じ助言」を抑制し、過去の危険を再利用する

**実装ポイント**
- 履歴（IndexedDB）から過去危険・直近期危険・ヒヤリハットを抽出
- 曜日と天候の注意情報を追加
- 1200文字上限で注入

**主な実装場所**
- `src/lib/contextUtils.ts`
- `src/lib/historyUtils.ts`
- `src/hooks/useChat.ts`

**完了条件**
- 直近の危険やヒヤリハットが会話に反映される
- コンテキストが無い場合は安全にスキップされる

---

## Phase 2.8 入力UI拡張（工程・体調）

**目的**
- 工程と体調を会話文脈に反映し、実情に即した助言にする

**実装ポイント**
- ホーム画面で工程と体調を選択
- セッションコンテキストとして `/api/chat` に送信
- フィードバック生成にも利用

**主な実装場所**
- `src/pages/HomePage.tsx`
- `src/constants/ky.ts`
- `workers/routes/chat.ts`
- `workers/routes/feedback.ts`

**完了条件**
- 工程/体調が画面上で選択できる
- チャット・フィードバック両方に反映される

---

## 依存関係と優先度

- Phase 2.1 は全フェーズの前提
- Phase 2.3 は Phase 2.7 の前提
- Phase 2.8 は Phase 2.7 と Phase 2.6 の入力素材
