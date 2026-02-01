/**
 * Zodバリデーション
 * AI出力のJSON検証に使用
 */
import type { ExtractedData, WorkItem } from '@/types/ky'
import { OptionalExtractedDataSchema } from '@/lib/kySchemas'

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
    return !!(
        item.workDescription &&
        item.hazardDescription &&
        item.riskLevel &&
        item.whyDangerous && item.whyDangerous.length > 0 &&
        item.countermeasures && item.countermeasures.length > 0
    )
}
