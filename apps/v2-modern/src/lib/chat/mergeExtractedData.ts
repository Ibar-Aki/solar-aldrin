import type { Countermeasure, ExtractedData, WorkItem } from '@/types/ky'
import { isWorkItemComplete } from '@/lib/validation'

type MergeResult = {
    workItemPatch: Partial<WorkItem>
    actionGoal: string | null
    shouldCommitWorkItem: boolean
}

const SHOULD_COMMIT_ACTIONS = new Set([
    'ask_more_work',
    'ask_goal',
    'confirm',
    'completed',
])

function mergeUniqueList(base: string[] | undefined, incoming: string[] | undefined): string[] | null {
    if (!incoming || incoming.length === 0) return null
    const merged = [...(base ?? []), ...incoming].filter((value, index, self) => self.indexOf(value) === index)
    return merged
}

function normalizeMeasureText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function mergeUniqueCountermeasures(
    base: Countermeasure[] | undefined,
    incoming: Countermeasure[] | undefined
): Countermeasure[] | null {
    if (!incoming || incoming.length === 0) return null
    const merged = [...(base ?? []), ...incoming]
        .map((cm) => ({ ...cm, text: normalizeMeasureText(cm.text) }))
        .filter((cm) => cm.text.length > 0)

    const seen = new Set<string>()
    const out: Countermeasure[] = []
    for (const cm of merged) {
        const key = cm.text.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(cm)
    }
    return out
}

export function mergeExtractedData(
    currentWorkItem: Partial<WorkItem>,
    data?: ExtractedData | null
): MergeResult {
    if (!data) {
        return { workItemPatch: {}, actionGoal: null, shouldCommitWorkItem: false }
    }

    const workItemPatch: Partial<WorkItem> = {}

    if (typeof data.workDescription === 'string' && data.workDescription.trim().length > 0) {
        workItemPatch.workDescription = data.workDescription
    }
    if (typeof data.hazardDescription === 'string' && data.hazardDescription.trim().length > 0) {
        workItemPatch.hazardDescription = data.hazardDescription
    }
    if (typeof data.riskLevel === 'number') {
        workItemPatch.riskLevel = data.riskLevel as 1 | 2 | 3 | 4 | 5
    }

    const mergedWhyDangerous = mergeUniqueList(currentWorkItem.whyDangerous, data.whyDangerous)
    if (mergedWhyDangerous) {
        workItemPatch.whyDangerous = mergedWhyDangerous
    }

    const mergedCountermeasures = mergeUniqueCountermeasures(currentWorkItem.countermeasures, data.countermeasures)
    if (mergedCountermeasures) {
        workItemPatch.countermeasures = mergedCountermeasures
    }

    const actionGoal =
        typeof data.actionGoal === 'string' && data.actionGoal.trim().length > 0
            ? data.actionGoal
            : null

    const shouldCommitWorkItem =
        !!data.nextAction &&
        SHOULD_COMMIT_ACTIONS.has(data.nextAction) &&
        isWorkItemComplete({ ...currentWorkItem, ...workItemPatch })

    return { workItemPatch, actionGoal, shouldCommitWorkItem }
}
