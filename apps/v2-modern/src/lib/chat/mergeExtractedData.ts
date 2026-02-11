import type { Countermeasure, ExtractedData, WorkItem } from '@/types/ky'
import { isWorkItemComplete } from '@/lib/validation'
import { isNonAnswerText } from '@/lib/nonAnswer'

type MergeResult = {
    workItemPatch: Partial<WorkItem>
    actionGoal: string | null
    shouldCommitWorkItem: boolean
}

const SHOULD_COMMIT_ACTIONS = new Set([
    'ask_goal',
    'confirm',
    'completed',
])

function mergeUniqueList(base: string[] | undefined, incoming: string[] | undefined): string[] | null {
    if (!incoming || incoming.length === 0) return null
    const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim()

    const merged = [...(base ?? []), ...incoming]
        .map((v) => (typeof v === 'string' ? normalize(v) : ''))
        .filter((v) => v.length > 0 && !isNonAnswerText(v))

    const seen = new Set<string>()
    const out: string[] = []
    for (const v of merged) {
        const key = v.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(v)
        if (out.length >= 3) break // 仕様: whyDangerous は最大3件
    }

    return out.length > 0 ? out : null
}

function normalizeMeasureText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function inferWhyDangerousFromContext(
    currentWorkItem: Partial<WorkItem>,
    data: ExtractedData
): string[] | undefined {
    const sourceCandidates = [
        data.hazardDescription,
        currentWorkItem.hazardDescription,
        data.workDescription,
        currentWorkItem.workDescription,
    ]
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.replace(/\s+/g, ' ').trim())
        .filter((v) => v.length > 0 && !isNonAnswerText(v))

    if (sourceCandidates.length === 0) return undefined

    for (const source of sourceCandidates) {
        if (/(ため|ので|から|により|によって|恐れがあります|危険があります|リスクがあります)/.test(source)) {
            return [source]
        }
        const stripped = source.replace(/[。.!！?？]+$/g, '').trim()
        if (stripped.length > 0) {
            return [`${stripped}ため`]
        }
    }

    return undefined
}

function mergeUniqueCountermeasures(
    base: Countermeasure[] | undefined,
    incoming: Countermeasure[] | undefined
): Countermeasure[] | null {
    if (!incoming || incoming.length === 0) return null
    const merged = [...(base ?? []), ...incoming]
        .map((cm) => ({ ...cm, text: normalizeMeasureText(cm.text) }))
        .filter((cm) => cm.text.length > 0 && !isNonAnswerText(cm.text))

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

    const hasCurrentWhyDangerous = (currentWorkItem.whyDangerous?.length ?? 0) > 0
    const whyDangerousIncoming =
        data.whyDangerous && data.whyDangerous.length > 0
            ? data.whyDangerous
            : (hasCurrentWhyDangerous ? undefined : inferWhyDangerousFromContext(currentWorkItem, data))
    const mergedWhyDangerous = mergeUniqueList(currentWorkItem.whyDangerous, whyDangerousIncoming)
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
