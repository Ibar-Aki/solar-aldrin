> [!IMPORTANT]
> このドキュメントは**初期設計フェーズ**の記録です。
> 最新の実装詳細、現在のAPI仕様、およびアーキテクチャについては、**[マスター技術リファレンス](../00_overview/00_Master_Technical_Reference.md)**を参照してください。

# データモデル設計（v2-modern）

**目的**: セッション/作業項目/抽出データの構造と整合性を定義する  
**更新日**: 2026-02-03

---

## 1. 主要エンティティ

- **SoloKYSession**: 一人KY活動のセッション
- **WorkItem**: 作業単位（作業 + 危険 + 要因 + 対策）
- **ExtractedData**: AIから抽出される断片データ
- **ChatMessage**: 対話ログ
- **FeedbackSummary / SupplementItem / PolishedGoal**: 事後フィードバック

---

## 2. SoloKYSession

```typescript
interface SoloKYSession {
  id: string

  userName: string
  siteName: string
  weather: string
  temperature: number | null
  processPhase: ProcessPhase | null
  healthCondition: HealthCondition | null

  workStartTime: string
  workEndTime: string | null
  createdAt: string
  completedAt: string | null

  environmentRisk: string | null

  workItems: WorkItem[]

  actionGoal: string | null
  pointingConfirmed: boolean | null

  allMeasuresImplemented: boolean | null
  hadNearMiss: boolean | null
  nearMissNote: string | null
}
```

---

## 3. WorkItem

```typescript
interface WorkItem {
  id: string
  workDescription: string
  hazardDescription: string
  riskLevel: 1 | 2 | 3 | 4 | 5
  whyDangerous: string[]
  countermeasures: string[]
}
```

---

## 4. ExtractedData（AI抽出）

```typescript
interface ExtractedData {
  workDescription?: string | null
  hazardDescription?: string | null
  riskLevel?: 1 | 2 | 3 | 4 | 5 | null
  whyDangerous?: string[]
  countermeasures?: string[]
  actionGoal?: string | null
  nextAction?: 'ask_work' | 'ask_hazard' | 'ask_why' | 'ask_countermeasure' | 'ask_risk_level' | 'ask_more_work' | 'ask_goal' | 'confirm' | 'completed'
}
```

---

## 5. 状態と一時データ

- **SessionStatus**
`basic_info` / `work_items` / `action_goal` / `confirmation` / `completed`

- **currentWorkItem**
会話途中の作業は `Partial<WorkItem>` として保持される。

---

## 6. 永続化

| 保存先 | 内容 | 技術 |
| :--- | :--- | :--- |
| localStorage | 進行中セッション、UI状態 | Zustand Persist |
| IndexedDB | 完了セッション履歴 | Dexie |

**IndexedDB スキーマ**

```typescript
class KYDatabase extends Dexie {
  sessions!: Table<SoloKYSession, string>
  constructor() {
    super('VoiceKYDatabase')
    this.version(1).stores({
      sessions: 'id, createdAt, siteName, userName'
    })
  }
}
```

---

## 7. 履歴の保持ポリシー

- **保持日数**: 90日
- **最大件数**: 100件
- **適用タイミング**: セッション保存後に自動適用

---

## 8. バリデーション

- Zodスキーマは `src/lib/kySchemas.ts` と `src/lib/schema.ts` に定義
- `messages` は `user` / `assistant` のみ許可
- `contextInjection` は最大長制限あり

---

## 9. 将来拡張

- ベクトル検索による類似危険の抽出
- サーバー同期（組織内共有）
