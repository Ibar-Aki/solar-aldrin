import { isNonAnswerText } from '../../../src/lib/nonAnswer'
import type { Countermeasure, CountermeasureCategory, ExtractedData } from '../../../src/types/ky'
import { COUNTERMEASURE_CATEGORY_ENUM, NEXT_ACTION_ENUM } from './config'

function normalizeString(value: string | null | undefined): string | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

function normalizeActionGoalCandidate(value: string): string {
    return value
        .replace(/\s+/g, ' ')
        .replace(/^[「『"\s]+/, '')
        .replace(/[」』"\s]+$/, '')
        .trim()
        .slice(0, 120)
}

function extractActionGoalFromUserText(value: string): string | undefined {
    const normalizedInput = value
        .replace(/\r?\n/g, ' ')
        .trim()

    if (!normalizedInput) return undefined

    const quotedMatches = [...normalizedInput.matchAll(/[「『"]([^「」『"\n]{2,120})[」』"]/g)]
    for (const match of quotedMatches) {
        const candidate = normalizeActionGoalCandidate(match[1] ?? '')
        if (candidate && !isNonAnswerText(candidate)) {
            return candidate
        }
    }

    const prefixed = normalizedInput.match(
        /(?:行動目標|目標)\s*(?:は|を|:|：)?\s*([^。.!！?？\n]+?)(?:です|にします|とします|にする|とする)?(?:$|。|!|！|\?|？)/
    )
    if (prefixed?.[1]) {
        const candidate = normalizeActionGoalCandidate(prefixed[1])
        if (candidate && !isNonAnswerText(candidate)) {
            return candidate
        }
    }

    return undefined
}

function hasCompletionIntentFromUserText(value: string): boolean {
    const normalized = value
        .normalize('NFKC')
        .replace(/\s+/g, '')
        .toLowerCase()

    if (!normalized) return false

    return (
        normalized.includes('確定')
        || normalized.includes('終了')
        || normalized.includes('完了')
        || normalized.includes('終わり')
        || normalized.includes('これでok')
        || normalized.includes('これで大丈夫')
        || normalized.includes('finish')
        || normalized.includes('done')
    )
}

function normalizeStringList(values: string[] | undefined): string[] | undefined {
    if (!values) return undefined
    const normalized = values
        .map((value) => normalizeString(value))
        .filter((value): value is string => Boolean(value))
    return normalized.length > 0 ? normalized : undefined
}

const COUNTERMEASURE_CATEGORIES: CountermeasureCategory[] = [...COUNTERMEASURE_CATEGORY_ENUM]

function isCountermeasureCategory(value: string): value is CountermeasureCategory {
    return COUNTERMEASURE_CATEGORIES.includes(value as CountermeasureCategory)
}

function fallbackClassifyCountermeasure(text: string): CountermeasureCategory {
    const normalized = text.normalize('NFKC')
    const ppeHints = [
        '保護具',
        'ヘルメット',
        '手袋',
        '防護',
        'ゴーグル',
        'マスク',
        '安全帯',
        '墜落制止用器具',
    ]
    const behaviorHints = [
        '声掛け',
        '合図',
        '確認',
        '手順',
        '教育',
        '巡視',
        '配置',
        '誘導',
    ]
    const equipmentHints = [
        '設備',
        '養生',
        '手すり',
        'バリケード',
        '柵',
        '照明',
        '治具',
        '機械',
        '装置',
    ]

    if (ppeHints.some((hint) => normalized.includes(hint))) return 'ppe'
    if (behaviorHints.some((hint) => normalized.includes(hint))) return 'behavior'
    if (equipmentHints.some((hint) => normalized.includes(hint))) return 'equipment'
    return 'behavior'
}

function normalizeCountermeasureText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function coerceCountermeasures(value: unknown): Countermeasure[] | undefined {
    if (value == null) return undefined

    const out: Countermeasure[] = []
    const push = (category: unknown, text: unknown) => {
        if (typeof text !== 'string') return
        const normalizedText = normalizeCountermeasureText(text)
        if (!normalizedText || isNonAnswerText(normalizedText)) return
        const normalizedCategory = typeof category === 'string' && isCountermeasureCategory(category)
            ? category
            : fallbackClassifyCountermeasure(normalizedText)
        out.push({
            category: normalizedCategory,
            text: normalizedText,
        })
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (!item || typeof item !== 'object') {
                if (typeof item === 'string') {
                    push(undefined, item)
                }
                continue
            }
            const record = item as Record<string, unknown>
            push(record.category, record.text)
        }
        return out.length > 0 ? out : undefined
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>
        push(record.category, record.text)
        return out.length > 0 ? out : undefined
    }

    if (typeof value === 'string') {
        push(undefined, value)
        return out.length > 0 ? out : undefined
    }

    return undefined
}

function normalizeCountermeasures(values: Countermeasure[] | undefined): Countermeasure[] | undefined {
    if (!values || values.length === 0) return undefined
    const normalized = values
        .map((cm) => ({
            category: isCountermeasureCategory(String(cm.category)) ? cm.category : fallbackClassifyCountermeasure(cm.text),
            text: normalizeCountermeasureText(cm.text),
        }))
        .filter((cm) => cm.text.length > 0 && !isNonAnswerText(cm.text))

    const seen = new Set<string>()
    const out: Countermeasure[] = []
    for (const cm of normalized) {
        const key = cm.text.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push(cm)
    }
    return out.length > 0 ? out : undefined
}

function coerceStringArray(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
        const normalized = value
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(item => item.length > 0 && !isNonAnswerText(item))

        if (normalized.length === 0) return undefined
        // 仕様: 最大3件 + できるだけ順序維持でユニーク化
        const uniq: string[] = []
        const seen = new Set<string>()
        for (const item of normalized) {
            if (seen.has(item)) continue
            seen.add(item)
            uniq.push(item)
            if (uniq.length >= 3) break
        }
        return uniq
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return undefined
        if (isNonAnswerText(trimmed)) return undefined
        return [trimmed]
    }

    return undefined
}

function coerceRiskLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
    const num = (() => {
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
            const parsed = Number.parseInt(value.trim(), 10)
            return Number.isFinite(parsed) ? parsed : NaN
        }
        return NaN
    })()

    if (num === 1 || num === 2 || num === 3 || num === 4 || num === 5) {
        return num
    }
    return undefined
}

function coerceNextAction(value: unknown): ExtractedData['nextAction'] | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    const allowed: Array<NonNullable<ExtractedData['nextAction']>> = [
        ...NEXT_ACTION_ENUM,
    ]
    return allowed.includes(normalized as NonNullable<ExtractedData['nextAction']>)
        ? (normalized as NonNullable<ExtractedData['nextAction']>)
        : undefined
}

function normalizeExtractedData(value: unknown): ExtractedData | undefined {
    if (!value || typeof value !== 'object') return undefined
    const raw = value as Record<string, unknown>

    const extracted: ExtractedData = {}

    if (typeof raw.workDescription === 'string') {
        const normalized = raw.workDescription.trim()
        if (normalized) extracted.workDescription = normalized
    }
    if (typeof raw.hazardDescription === 'string') {
        const normalized = raw.hazardDescription.trim()
        if (normalized) extracted.hazardDescription = normalized
    }

    const riskLevel = coerceRiskLevel(raw.riskLevel)
    if (riskLevel) extracted.riskLevel = riskLevel

    const whyDangerous = coerceStringArray(raw.whyDangerous)
    if (whyDangerous) extracted.whyDangerous = whyDangerous

    const countermeasures = coerceCountermeasures(raw.countermeasures)
    if (countermeasures) extracted.countermeasures = countermeasures

    if (typeof raw.actionGoal === 'string') {
        const normalized = raw.actionGoal.trim()
        if (normalized) extracted.actionGoal = normalized
    }

    const nextAction = coerceNextAction(raw.nextAction)
    if (nextAction) extracted.nextAction = nextAction

    return Object.keys(extracted).length > 0 ? extracted : undefined
}

export function normalizeModelResponse(
    rawParsed: unknown,
    requestMessages: Array<{ role: 'user' | 'assistant'; content: string }>
): { reply: string; extracted?: unknown } {
    const obj = (rawParsed && typeof rawParsed === 'object')
        ? (rawParsed as Record<string, unknown>)
        : {}

    const reply = typeof obj.reply === 'string'
        ? obj.reply
        : typeof obj.message === 'string'
            ? obj.message
            : obj.reply != null
                ? String(obj.reply)
                : ''

    // Some model outputs may accidentally place extracted fields at top-level.
    const extractedCandidate = (obj.extracted && typeof obj.extracted === 'object')
        ? obj.extracted
        : obj

    const extractedRecord = extractedCandidate && typeof extractedCandidate === 'object'
        ? (extractedCandidate as Record<string, unknown>)
        : undefined
    const rawNextAction = typeof extractedRecord?.nextAction === 'string'
        ? extractedRecord.nextAction.trim()
        : ''
    const hasInvalidRawNextAction =
        rawNextAction.length > 0 &&
        !NEXT_ACTION_ENUM.includes(rawNextAction as (typeof NEXT_ACTION_ENUM)[number])

    const normalizedExtracted = normalizeExtractedData(extractedCandidate)

    const lastUserText = (() => {
        for (let i = requestMessages.length - 1; i >= 0; i -= 1) {
            const msg = requestMessages[i]
            if (msg.role === 'user') return msg.content ?? ''
        }
        return ''
    })()

    const actionGoalFromUser = extractActionGoalFromUserText(lastUserText)
    const completionIntentFromUser = hasCompletionIntentFromUserText(lastUserText)
    const extracted = (() => {
        if (!actionGoalFromUser) return normalizedExtracted

        const nextAction = normalizedExtracted?.nextAction
        const hasActionGoal = Boolean(normalizedExtracted?.actionGoal?.trim())
        const asksGoalAgain = nextAction === 'ask_goal'

        // 目標入力が明確なのに ask_goal が返ってきた場合は、確認フェーズへ前進させる。
        if (!asksGoalAgain && hasActionGoal && !completionIntentFromUser) {
            return normalizedExtracted
        }

        return {
            ...(normalizedExtracted ?? {}),
            actionGoal: hasActionGoal ? normalizedExtracted?.actionGoal : actionGoalFromUser,
            nextAction: completionIntentFromUser || asksGoalAgain ? 'confirm' : (nextAction ?? 'confirm'),
        } satisfies ExtractedData
    })()

    const buildFallbackReply = (value: ExtractedData | undefined): string => {
        const nextAction = value?.nextAction
        if (nextAction) {
            switch (nextAction) {
                case 'ask_work':
                    return '今日行う作業内容を教えてください。'
                case 'ask_hazard':
                    return 'その作業で考えられる危険を教えてください。'
                case 'ask_why':
                    return 'どのような状況でその危険が起きそうですか？'
                case 'ask_risk_level':
                    return 'この作業の危険度は1〜5でいくつですか？'
                case 'ask_countermeasure':
                    return 'その危険を防ぐための対策を教えてください。（設備・環境 / 人配置・行動 / 保護具 のどれでもOK。合計2件以上あると安心です）'
                case 'ask_more_work':
                    return '他に今日行う作業はありますか？'
                case 'ask_goal':
                    return '今日いちばん意識する行動目標を、短い言葉で決めると何にしますか？'
                case 'confirm':
                    return 'ここまでの内容で確定してよろしいですか？'
                case 'completed':
                    return 'ありがとうございます。画面の案内に沿って完了してください。'
                default:
                    break
            }
        }

        // extracted が欠落/不十分な場合は、直近のユーザー発話から復旧する（会話を巻き戻しすぎない）
        const last = String(lastUserText || '').trim()
        if (last) {
            // 危険度の入力直後は対策へ進める
            if (last.includes('危険度') || /(?:危険度|リスク)\s*(?:は|=|:)?\s*[1-5]/.test(last)) {
                return 'その危険を防ぐための対策を教えてください。（具体的に「どこに」「どう使うか」まで）'
            }

            // 「他にありません」等は、次のフェーズへ（行動目標）
            if (/(他に|ほかに).*(ありません|ない)/.test(last) || /^ありません[。.!?]?$/.test(last)) {
                return 'では、今日いちばん意識する行動目標を、短い言葉で決めると何にしますか？'
            }

            // 原因説明っぽい発話（要因フェーズ）なら、危険度確認へ進める
            if (/(ため|ので|原因|要因|不十分|届く|近い|滑る|見えない|暗い|狭い)/.test(last)) {
                return 'この作業の危険度は1〜5でいくつですか？'
            }

            // 対策っぽい発話（動作・実施が含まれる）なら、追加の対策確認へ
            if (
                last.includes('対策') ||
                /(設置|配置|着用|点検|養生(する|します|実施)|覆(う|って)|区画|立入(禁止)?|確認(する|します)|声掛け|合図)/.test(last)
            ) {
                return '他に対策はありますか？なければ「他にありません」と教えてください。'
            }
        }

        // 最後の保険（単発で状況を取り戻す）
        return 'すみません、確認します。今の作業について、危険・要因・危険度・対策のうち、まだ確認できていないものから教えてください。'
    }

    const normalizedReply = typeof reply === 'string' ? reply.trim() : ''
    const GENERIC_NON_FACILITATION_PREFIXES = [
        '承知しました。続けてください。',
        '了解しました。続けてください。',
        '分かりました。続けてください。',
        'わかりました。続けてください。',
        '続けてください。',
    ]
    const looksLikeNonFacilitation =
        normalizedReply === '' ||
        GENERIC_NON_FACILITATION_PREFIXES.some((p) => normalizedReply === p || normalizedReply.startsWith(p))

    const extractedForResponse = (() => {
        // モデルが明示した nextAction が不正値だった場合は握りつぶさず検知可能にする。
        if (!actionGoalFromUser && hasInvalidRawNextAction) {
            return {
                ...(extracted ?? {}),
                nextAction: rawNextAction,
            }
        }
        return extracted
    })()

    return {
        reply: looksLikeNonFacilitation ? buildFallbackReply(extracted) : reply,
        ...(extractedForResponse ? { extracted: extractedForResponse } : {}),
    }
}

/**
 * 3.8: LLMが返した抽出JSONのうち、未確定の空値(null/空文字/空配列)を削除する。
 */
export function compactExtractedData(extracted?: ExtractedData): ExtractedData | undefined {
    if (!extracted) return undefined

    const compacted: ExtractedData = {}

    const workDescription = normalizeString(extracted.workDescription)
    if (workDescription) compacted.workDescription = workDescription

    const hazardDescription = normalizeString(extracted.hazardDescription)
    if (hazardDescription) compacted.hazardDescription = hazardDescription

    if (typeof extracted.riskLevel === 'number') {
        compacted.riskLevel = extracted.riskLevel
    }

    const whyDangerous = normalizeStringList(extracted.whyDangerous)
    if (whyDangerous) compacted.whyDangerous = whyDangerous

    const countermeasures = normalizeCountermeasures(extracted.countermeasures)
    if (countermeasures) compacted.countermeasures = countermeasures

    const actionGoal = normalizeString(extracted.actionGoal)
    if (actionGoal) compacted.actionGoal = actionGoal

    if (extracted.nextAction) {
        compacted.nextAction = extracted.nextAction
    }

    return Object.keys(compacted).length > 0 ? compacted : undefined
}
