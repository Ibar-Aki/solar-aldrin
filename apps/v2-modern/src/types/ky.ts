/**
 * KY セッションの型定義
 * 一人KY活動用のデータ構造
 * 
 * REF-01: ProcessPhase, HealthCondition は kySchemas の Zod スキーマから推論
 */

// Zodスキーマから推論された型をインポート
import type {
    ProcessPhaseFromZod,
    HealthConditionFromZod,
    CountermeasureCategoryFromZod,
    CountermeasureFromZod,
} from '@/lib/kySchemas'

// 型エイリアスとしてエクスポート（単一真実源）
export type ProcessPhase = ProcessPhaseFromZod
export type HealthCondition = HealthConditionFromZod
export type CountermeasureCategory = CountermeasureCategoryFromZod
export type Countermeasure = CountermeasureFromZod

/** 行動目標後の最終安全確認チェック */
export interface SafetyConfirmationChecks {
    /** 指差し呼称 */
    pointAndCall: boolean
    /** 工具・ワイヤー点検 */
    toolAndWireInspection: boolean
    /** 保護具準備 */
    ppeReady: boolean
    /** 退避経路・連絡手段確認 */
    evacuationRouteAndContact: boolean
}

/** 作業単位（作業 + 危険 + なぜ + 対策 のセット） */
export interface WorkItem {
    /** 一意識別子 (uuid) */
    id: string
    /** 作業内容の詳細 */
    workDescription: string
    /** 危険内容 */
    hazardDescription: string
    /** 危険度（1〜5の数値評価） */
    riskLevel: 1 | 2 | 3 | 4 | 5
    /** なぜ危険か（複数の理由） */
    whyDangerous: string[]
    /** 対策（複数） */
    countermeasures: Countermeasure[]
}

/** 一人KYセッション */
export interface SoloKYSession {
    /** セッションID (uuid) */
    id: string

    // === 基本情報 ===
    /** 作業者名 */
    userName: string
    /** 現場名 */
    siteName: string
    /** 天候 */
    weather: string
    /** 気温（℃） */
    temperature: number | null
    /** 作業工程 (UX-11) */
    processPhase: ProcessPhase | null
    /** 体調チェック (UX-12) */
    healthCondition: HealthCondition | null
    /** 作業開始時刻 (ISO 8601) */
    workStartTime: string
    /** 作業終了時刻 (ISO 8601) */
    workEndTime: string | null
    /** セッション作成日時 (ISO 8601) */
    createdAt: string

    // === 環境リスク ===
    /** AI自動生成の環境リスク情報 */
    environmentRisk: string | null

    // === 作業と危険 ===
    /** 作業項目リスト */
    workItems: WorkItem[]

    // === 行動目標と確認 ===
    /** 今日の行動目標 */
    actionGoal: string | null
    /** 指差し確認実施フラグ */
    pointingConfirmed: boolean | null
    /** 行動目標後の安全確認チェック（4項目） */
    safetyChecks?: SafetyConfirmationChecks | null

    // === 完了確認 ===
    /** 全対策実施フラグ */
    allMeasuresImplemented: boolean | null
    /** ヒヤリハット発生フラグ */
    hadNearMiss: boolean | null
    /** ヒヤリハット備考 */
    nearMissNote: string | null
    /** セッション完了日時 (ISO 8601) */
    completedAt: string | null
}

/** セッションステータス */
export type SessionStatus =
    | 'basic_info'    // 基本情報入力中
    | 'work_items'    // 作業・危険入力中
    | 'action_goal'   // 行動目標設定中
    | 'confirmation'  // 完了確認中
    | 'completed'     // 完了

/** AI から抽出されるデータ */
export interface ExtractedData {
    workDescription?: string | null
    hazardDescription?: string | null
    riskLevel?: 1 | 2 | 3 | 4 | 5 | null
    whyDangerous?: string[]
    countermeasures?: Countermeasure[]
    actionGoal?: string | null
    nextAction?: 'ask_work' | 'ask_hazard' | 'ask_why' | 'ask_countermeasure' | 'ask_risk_level' | 'ask_more_work' | 'ask_goal' | 'confirm' | 'completed'
}

/** フィードバック要約 */
export interface FeedbackSummary {
    praise: string
    tip: string
}

/** AI補足項目 */
export interface SupplementItem {
    risk: string
    measure: string
}

/** 行動目標の添削提案 */
export interface PolishedGoal {
    original: string
    polished: string
}

/** チャットメッセージ */
export interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string  // ISO 8601
    extractedData?: ExtractedData
}
