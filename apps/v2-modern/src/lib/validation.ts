/**
 * Zodバリデーション
 * AI出力のJSON検証に使用
 */
import type { ExtractedData, WorkItem } from '@/types/ky'
import { OptionalExtractedDataSchema } from '@/lib/kySchemas'

function countCountermeasures(countermeasures: WorkItem['countermeasures'] | undefined): number {
    if (!countermeasures || countermeasures.length === 0) return 0
    return countermeasures.filter((cm) => Boolean(cm.text?.trim())).length
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

/** 作業アイテムが完成しているかチェック */
export function isWorkItemComplete(item: Partial<WorkItem>): boolean {
    const measureCount = countCountermeasures(item.countermeasures)
    const whyCount = (item.whyDangerous ?? []).filter((v) => Boolean(v?.trim())).length
    return !!(
        item.workDescription && item.workDescription.trim().length > 0 &&
        item.hazardDescription && item.hazardDescription.trim().length > 0 &&
        item.riskLevel &&
        whyCount >= 1 &&
        measureCount >= 2
    )
}
