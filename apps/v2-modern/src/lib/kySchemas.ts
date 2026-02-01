import { z } from 'zod'

/**
 * 共通スキーマ定義
 * - 型/バリデーションの重複を避けるためここに集約
 */

/** 作業工程スキーマ */
export const ProcessPhaseSchema = z.enum([
    '搬入・荷受け',
    '基礎土台・建地準備',
    '組み立て',
    '付帯設備設置・仕上げ',
    '引き渡し前確認',
    'フリー',
])
/** 作業工程型（Zodから推論） */
export type ProcessPhaseFromZod = z.infer<typeof ProcessPhaseSchema>

/** 体調スキーマ */
export const HealthConditionSchema = z.enum(['bad', 'good', 'great'])
/** 体調型（Zodから推論） */
export type HealthConditionFromZod = z.infer<typeof HealthConditionSchema>

/** AI抽出データのスキーマ */
export const ExtractedDataSchema = z.object({
    workDescription: z.string().nullable().optional(),
    hazardDescription: z.string().nullable().optional(),
    riskLevel: z.number().min(1).max(5).nullable().optional(),
    whyDangerous: z.array(z.string()).optional(),
    countermeasures: z.array(z.string()).optional(),
    actionGoal: z.string().nullable().optional(),
    nextAction: z.enum([
        'ask_work',
        'ask_hazard',
        'ask_why',
        'ask_countermeasure',
        'ask_risk_level',
        'ask_more_work',
        'ask_goal',
        'confirm',
        'completed',
    ]).optional(),
})
export const OptionalExtractedDataSchema = ExtractedDataSchema.optional()

/** 完全な作業項目スキーマ */
export const WorkItemSchema = z.object({
    id: z.string().uuid(),
    workDescription: z.string().min(1),
    hazardDescription: z.string().min(1),
    riskLevel: z.number().min(1).max(5),
    whyDangerous: z.array(z.string()).min(1),
    countermeasures: z.array(z.string()).min(1),
})

/** ISO 8601 日付文字列のスキーマ（ミリ秒対応） */
export const ISO8601Schema = z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)$/,
    'ISO 8601形式である必要があります'
)

/** セッションスキーマ */
export const SoloKYSessionSchema = z.object({
    id: z.string().uuid(),
    userName: z.string().min(1),
    siteName: z.string().min(1),
    weather: z.string(),
    temperature: z.number().nullable(),
    processPhase: ProcessPhaseSchema.nullable(),
    healthCondition: HealthConditionSchema.nullable(),
    workStartTime: ISO8601Schema,
    workEndTime: ISO8601Schema.nullable(),
    createdAt: ISO8601Schema,
    environmentRisk: z.string().nullable(),
    workItems: z.array(WorkItemSchema),
    actionGoal: z.string().nullable(),
    pointingConfirmed: z.boolean().nullable(),
    allMeasuresImplemented: z.boolean().nullable(),
    hadNearMiss: z.boolean().nullable(),
    nearMissNote: z.string().nullable(),
    completedAt: ISO8601Schema.nullable(),
})
