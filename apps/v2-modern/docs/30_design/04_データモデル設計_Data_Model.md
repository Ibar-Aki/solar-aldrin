# データモデル設計（Phase 2.3 対応）

**目的**: セッション/記録/作業項目の構造と整合性を定義する  
**更新日**: 2026-01-31  
**対応Phase**: 2.3 (履歴管理・データ永続化)

---

## 1. 主要エンティティ

- **SoloKYSession**: 一人KY活動のセッション（進行中/完了済み共通）
- **WorkItem**: 作業単位（作業内容 + 危険 + 対策）
- **ProcessPhase**: 作業工程の選択肢
- **HealthCondition**: 体調チェックの選択肢
- **ExtractedData**: AIから抽出されるデータ
- **ChatMessage**: 対話メッセージ

---

## 2. SoloKYSession（一人KYセッション）

```typescript
interface SoloKYSession {
    // 識別子
    id: string              // UUID v4

    // 基本情報
    userName: string        // 作業者名
    siteName: string        // 現場名
    weather: string         // 天候
    temperature: number | null  // 気温（℃）
    processPhase: ProcessPhase | null  // 作業工程 (UX-11)
    healthCondition: HealthCondition | null  // 体調 (UX-12)
    
    // 時刻情報
    workStartTime: string   // 作業開始時刻 (ISO 8601)
    workEndTime: string | null  // 作業終了時刻
    createdAt: string       // セッション作成日時
    completedAt: string | null  // 完了日時

    // 環境リスク
    environmentRisk: string | null  // AI自動生成

    // 作業と危険
    workItems: WorkItem[]   // 作業項目リスト

    // 行動目標と確認
    actionGoal: string | null  // 今日の行動目標
    pointingConfirmed: boolean | null  // 指差し確認実施

    // 完了確認
    allMeasuresImplemented: boolean | null  // 全対策実施
    hadNearMiss: boolean | null  // ヒヤリハット発生
    nearMissNote: string | null  // ヒヤリハット備考
}
```

---

## 3. WorkItem（作業項目）

```typescript
interface WorkItem {
    id: string              // UUID v4
    workDescription: string // 作業内容の詳細
    hazardDescription: string  // 危険内容
    riskLevel: 1 | 2 | 3 | 4 | 5  // 危険度評価
    whyDangerous: string[]  // なぜ危険か（複数の理由）
    countermeasures: string[]  // 対策（複数）
}
```

---

## 4. 選択肢型

### ProcessPhase（作業工程）

```typescript
type ProcessPhase =
    | '搬入・荷受け'
    | '基礎土台・建地準備'
    | '組み立て'
    | '付帯設備設置・仕上げ'
    | '引き渡し前確認'
    | 'フリー'
```

### HealthCondition（体調）

```typescript
type HealthCondition = 'bad' | 'good' | 'great'
```

### SessionStatus（セッション状態）

```typescript
type SessionStatus =
    | 'basic_info'    // 基本情報入力中
    | 'work_items'    // 作業・危険入力中
    | 'action_goal'   // 行動目標設定中
    | 'confirmation'  // 完了確認中
    | 'completed'     // 完了
```

---

## 5. 保存先と永続化

| 保存先 | 用途 | 技術 |
| :--- | :--- | :--- |
| **ローカル** | 履歴保存・オフライン対応 | IndexedDB (Dexie.js) |
| **サーバー** | 組織共有・バックアップ（将来） | Supabase 等 |

### IndexedDB スキーマ

```typescript
// db.ts
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

## 6. バリデーション

- **Zod スキーマ**: `validation.ts` で定義
- **ISO 8601**: 日時フィールドはミリ秒対応
- **必須/任意**: processPhase, healthCondition は null 許容
- **配列**: workItems, whyDangerous, countermeasures は空配列許容

---

## 7. 将来拡張

- ベクトル検索（RAGの精度向上）
- 組織/現場ごとの権限分離
- サーバー同期（オンライン時に自動バックアップ）
