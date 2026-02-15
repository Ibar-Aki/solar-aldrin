import { isNonAnswerText } from '../../../src/lib/nonAnswer'
import type { ExtractedData } from '../../../src/types/ky'

type GuardedResult = {
    extracted: ExtractedData | undefined
    askWhyEnforced: boolean
}

function normalizeLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function normalizeForCompare(value: string): string {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s\u3000]/g, '')
        .replace(/[。．.!！?？、,，・/]/g, '')
}

function looksLikeWorkDescription(text: string): boolean {
    return /(するとき|する時|作業|工程|実施|行う|中に|中で|最中)/.test(text)
}

function looksLikeCauseDescription(text: string): boolean {
    return /(ため|ので|から|により|によって|不十分|不足|劣化|滑り|見えにく|狭|近接|傾斜|故障|不安定|強風|雨|暗|騒音|怠)/.test(text)
}

function isLikelyDuplicateCause(workDescription: string, why: string): boolean {
    const work = normalizeForCompare(workDescription)
    const cause = normalizeForCompare(why)

    if (!work || !cause) return false
    if (work === cause) return true

    const includes = work.includes(cause) || cause.includes(work)
    if (includes) {
        const lengthRatio = Math.min(work.length, cause.length) / Math.max(work.length, cause.length)
        if (lengthRatio >= 0.75) return true
    }

    if (looksLikeWorkDescription(why) && !looksLikeCauseDescription(why)) {
        return true
    }

    return false
}

function sanitizeWhyDangerous(
    workDescription: string | undefined,
    whyDangerous: string[] | undefined
): { values: string[] | undefined; removedContaminated: boolean } {
    if (!whyDangerous || whyDangerous.length === 0) {
        return { values: undefined, removedContaminated: false }
    }

    const out: string[] = []
    const seen = new Set<string>()
    let removedContaminated = false

    for (const raw of whyDangerous) {
        const normalized = normalizeLine(raw)
        if (!normalized || isNonAnswerText(normalized)) {
            removedContaminated = true
            continue
        }

        if (workDescription && isLikelyDuplicateCause(workDescription, normalized)) {
            removedContaminated = true
            continue
        }

        const key = normalized.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(normalized)
        if (out.length >= 3) break
    }

    return {
        values: out.length > 0 ? out : undefined,
        removedContaminated,
    }
}

function shouldForceAskWhy(nextAction: ExtractedData['nextAction'] | undefined): boolean {
    return nextAction !== 'ask_work'
        && nextAction !== 'ask_hazard'
        && nextAction !== 'ask_why'
}

export function applyKyFieldGuard(extracted: ExtractedData | undefined): GuardedResult {
    if (!extracted) return { extracted, askWhyEnforced: false }

    const workDescription =
        typeof extracted.workDescription === 'string' && extracted.workDescription.trim().length > 0
            ? normalizeLine(extracted.workDescription)
            : undefined

    const sanitized = sanitizeWhyDangerous(workDescription, extracted.whyDangerous)

    const nextAction = (() => {
        if (!sanitized.removedContaminated || sanitized.values) {
            return extracted.nextAction
        }
        if (shouldForceAskWhy(extracted.nextAction)) {
            return 'ask_why' as const
        }
        return extracted.nextAction
    })()

    return {
        extracted: {
            ...extracted,
            ...(workDescription ? { workDescription } : {}),
            ...(sanitized.values ? { whyDangerous: sanitized.values } : { whyDangerous: undefined }),
            ...(nextAction ? { nextAction } : {}),
        },
        askWhyEnforced: Boolean(
            sanitized.removedContaminated &&
            !sanitized.values &&
            nextAction === 'ask_why' &&
            extracted.nextAction !== 'ask_why'
        ),
    }
}
