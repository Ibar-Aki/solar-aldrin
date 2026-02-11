/**
 * Zodバリデーション
 * AI出力のJSON検証に使用
 */
import type { ExtractedData, WorkItem } from '@/types/ky'
import { OptionalExtractedDataSchema } from '@/lib/kySchemas'
import { isNonAnswerText } from '@/lib/nonAnswer'

function countCountermeasures(countermeasures: WorkItem['countermeasures'] | undefined): number {
    if (!countermeasures || countermeasures.length === 0) return 0
    return countermeasures
        .map((cm) => (typeof cm.text === 'string' ? cm.text.trim() : ''))
        .filter((text) => text.length > 0 && !isNonAnswerText(text))
        .length
}

/** AI応答のJSONをパースして検証 */
export function parseExtractedData(jsonString: string): ExtractedData | null {
    try {
        const parsed = JSON.parse(jsonString)
        const result = OptionalExtractedDataSchema.safeParse(parsed)
        if (result.success) {
            return result.data ?? null
        }
        console.warn('ExtractedData validation failed:', result.error)
        return null
    } catch (e) {
        console.warn('JSON parse failed:', e)
        return null
    }
}

/** 想定される危険セクション（上段4項目）が完成しているかチェック */
export function isHazardSectionComplete(item: Partial<WorkItem>): boolean {
    const whyCount = (item.whyDangerous ?? [])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0 && !isNonAnswerText(v))
        .length

    return !!(
        item.workDescription && item.workDescription.trim().length > 0 &&
        item.hazardDescription && item.hazardDescription.trim().length > 0 &&
        item.riskLevel &&
        whyCount >= 1
    )
}

/** 作業アイテムが完成しているかチェック */
export function isWorkItemComplete(item: Partial<WorkItem>): boolean {
    const measureCount = countCountermeasures(item.countermeasures)
    return !!(
        isHazardSectionComplete(item) &&
        measureCount >= 2
    )
}
