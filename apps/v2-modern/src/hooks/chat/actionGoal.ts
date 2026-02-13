import { isNonAnswerText } from '@/lib/nonAnswer'

const ACTION_GOAL_MAX_LENGTH = 120

export function normalizeActionGoalText(value: string): string {
    return value
        .replace(/\s+/g, ' ')
        .replace(/^[「『"\s]+/, '')
        .replace(/[」』"\s]+$/, '')
        .trim()
        .slice(0, ACTION_GOAL_MAX_LENGTH)
}

function isLikelyActionGoalPhrase(value: string): boolean {
    if (!value) return false
    const normalized = normalizeActionGoalText(value)
    if (!normalized) return false
    if (isNonAnswerText(normalized)) return false
    if (normalized.length > 40) return false
    if (/^(はい|了解|ok|okay|お願いします|大丈夫です)$/i.test(normalized)) return false
    return /(よし|ヨシ|確認|徹底|厳守|実施)/.test(normalized)
}

export function extractActionGoalFromText(text: string): string | null {
    const normalizedInput = text
        .replace(/\r?\n/g, ' ')
        .trim()

    if (!normalizedInput) return null

    const quotedMatches = [...normalizedInput.matchAll(/[「『"]([^「」『"\n]{2,120})[」』"]/g)]
    for (const match of quotedMatches) {
        const candidate = normalizeActionGoalText(match[1] ?? '')
        if (candidate && !isNonAnswerText(candidate)) {
            return candidate
        }
    }

    const prefixed = normalizedInput.match(
        /(?:行動目標|目標)\s*(?:は|を|:|：)?\s*([^。.!！?？\n]+?)(?:です|にします|とします|にする|とする)?(?:$|。|!|！|\?|？)/
    )
    if (prefixed?.[1]) {
        const candidate = normalizeActionGoalText(
            prefixed[1].replace(/(?:これで.*|内容を.*|終了.*|完了.*)$/u, '').trim()
        )
        if (candidate && !isNonAnswerText(candidate)) {
            return candidate
        }
    }

    if (isLikelyActionGoalPhrase(normalizedInput)) {
        return normalizeActionGoalText(normalizedInput)
    }

    return null
}

export function hasCompletionIntent(text: string): boolean {
    const normalized = text
        .normalize('NFKC')
        .replace(/\s+/g, '')
        .toLowerCase()
    if (!normalized) return false
    return (
        normalized.includes('確定') ||
        normalized.includes('終了') ||
        normalized.includes('完了') ||
        normalized.includes('終わり') ||
        normalized.includes('これでok') ||
        normalized.includes('これで大丈夫') ||
        normalized.includes('finish') ||
        normalized.includes('done')
    )
}
