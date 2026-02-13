import { isNonAnswerText } from '@/lib/nonAnswer'
import { isWorkItemComplete } from '@/lib/validation'
import type { Countermeasure, WorkItem } from '@/types/ky'

export function countValidCountermeasures(countermeasures: Countermeasure[] | undefined): number {
    if (!countermeasures || countermeasures.length === 0) return 0
    return countermeasures
        .map((cm) => (typeof cm.text === 'string' ? cm.text.trim() : ''))
        .filter((text) => text.length > 0 && !isNonAnswerText(text))
        .length
}

export function limitCountermeasuresToThree(countermeasures: Countermeasure[] | undefined): Countermeasure[] {
    if (!countermeasures || countermeasures.length === 0) return []
    return countermeasures
        .map((cm) => ({ ...cm, text: typeof cm.text === 'string' ? cm.text.trim() : '' }))
        .filter((cm) => cm.text.length > 0 && !isNonAnswerText(cm.text))
        .slice(0, 3)
}

export function isFirstWorkItemCompletionPending(
    status: string,
    workItemCount: number,
    currentWorkItem: Partial<WorkItem>
): boolean {
    return status === 'work_items' && workItemCount === 0 && isWorkItemComplete(currentWorkItem)
}

export function isMoveToSecondKyIntent(text: string): boolean {
    const normalized = text
        .normalize('NFKC')
        .trim()
        .replace(/[\s\u3000]+/g, '')
        .toLowerCase()

    if (!normalized) return false

    return (
        (normalized.includes('2件目') && (normalized.includes('移') || normalized.includes('次'))) ||
        normalized.includes('次へ') ||
        normalized.includes('移ります') ||
        normalized.includes('移動します') ||
        normalized.includes('他にありません') ||
        normalized.includes('これで十分') ||
        normalized.includes('これで完了')
    )
}
