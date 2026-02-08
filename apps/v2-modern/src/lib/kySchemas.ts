import { z } from 'zod'

/**
 * 共通スキーマ定義
 * - 型/バリデーションの重複を避けるためここに集約
 */

function normalizeLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function coerceStringArray(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
        const out = value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        return out.length > 0 ? [...new Set(out)] : undefined
    }
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed ? [trimmed] : undefined
    }
    return undefined
}

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

/** 対策カテゴリスキーマ */
export const CountermeasureCategorySchema = z.enum(['ppe', 'behavior', 'equipment'])
/** 対策カテゴリ型（Zodから推論） */
export type CountermeasureCategoryFromZod = z.infer<typeof CountermeasureCategorySchema>

const COUNTERMEASURE_CATEGORIES: CountermeasureCategoryFromZod[] = ['ppe', 'behavior', 'equipment']
function isCountermeasureCategory(value: string): value is CountermeasureCategoryFromZod {
    return (COUNTERMEASURE_CATEGORIES as string[]).includes(value)
}

// Client-side fallback classification (keeps UI resilient to backend/drift).
function fallbackClassifyCountermeasure(text: string): CountermeasureCategoryFromZod {
    const t = text.toLowerCase()
    // ppe
    if (
        t.includes('ヘルメ') ||
        t.includes('ヘルメット') ||
        t.includes('安全帯') ||
        t.includes('ハーネス') ||
        t.includes('手袋') ||
        t.includes('保護') ||
        t.includes('ゴーグル') ||
        t.includes('マスク')
    ) {
        return 'ppe'
    }
    // equipment / preparation
    if (
        t.includes('足場') ||
        t.includes('手すり') ||
        t.includes('親綱') ||
        t.includes('点検') ||
        t.includes('養生') ||
        t.includes('区画') ||
        t.includes('立入') ||
        t.includes('台車') ||
        t.includes('工具') ||
        t.includes('設備') ||
        t.includes('準備') ||
        t.includes('消火器') ||
        t.includes('スパッタ') ||
        t.includes('防火') ||
        t.includes('消火')
    ) {
        return 'equipment'
    }
    return 'behavior'
}

function coerceCountermeasures(value: unknown): Array<{ category: CountermeasureCategoryFromZod; text: string }> | undefined {
    const out: Array<{ category: CountermeasureCategoryFromZod; text: string }> = []

    const push = (category: unknown, text: unknown) => {
        if (typeof text !== 'string') return
        const normalizedText = normalizeLine(text)
        if (!normalizedText) return

        const cat =
            typeof category === 'string' && isCountermeasureCategory(category.trim())
                ? (category.trim() as CountermeasureCategoryFromZod)
                : fallbackClassifyCountermeasure(normalizedText)

        out.push({ category: cat, text: normalizedText })
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (typeof item === 'string') {
                push(undefined, item)
                continue
            }
            if (item && typeof item === 'object') {
                const obj = item as { category?: unknown; text?: unknown }
                // Accept legacy shapes: { text }, { category, text }, or even { value: "..." }.
                push(obj.category, obj.text ?? (item as { value?: unknown }).value)
            }
        }
    } else if (typeof value === 'string') {
        push(undefined, value)
    } else if (value && typeof value === 'object') {
        const obj = value as { category?: unknown; text?: unknown; value?: unknown }
        push(obj.category, obj.text ?? obj.value)
    }

    if (out.length === 0) return undefined

    const seen = new Set<string>()
    const deduped: typeof out = []
    for (const cm of out) {
        const key = cm.text.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(cm)
    }
    return deduped
}

/** 対策スキーマ */
export const CountermeasureSchema = z.object({
    category: CountermeasureCategorySchema,
    text: z.string().min(1),
})
export type CountermeasureFromZod = z.infer<typeof CountermeasureSchema>

const RiskLevelSchema = z.preprocess((value) => {
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value.trim(), 10)
        return Number.isFinite(parsed) ? parsed : value
    }
    return value
}, z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable())

/** AI抽出データのスキーマ */
export const ExtractedDataSchema = z.object({
    workDescription: z.string().nullable().optional(),
    hazardDescription: z.string().nullable().optional(),
    // Allow legacy / drifted shapes and normalize.
    riskLevel: RiskLevelSchema.optional(),
    whyDangerous: z.preprocess(coerceStringArray, z.array(z.string())).optional(),
    countermeasures: z.preprocess(coerceCountermeasures, z.array(CountermeasureSchema)).optional(),
    actionGoal: z.string().nullable().optional(),
    nextAction: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.enum([
        'ask_work',
        'ask_hazard',
        'ask_why',
        'ask_countermeasure',
        'ask_risk_level',
        'ask_more_work',
        'ask_goal',
        'confirm',
        'completed',
    ])).optional(),
})
export const OptionalExtractedDataSchema = ExtractedDataSchema.optional()

/** 完全な作業項目スキーマ */
export const WorkItemSchema = z.object({
    id: z.string().uuid(),
    workDescription: z.string().min(1),
    hazardDescription: z.string().min(1),
    riskLevel: z.number().min(1).max(5),
    whyDangerous: z.array(z.string()).min(1),
    countermeasures: z.array(CountermeasureSchema).min(1),
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
