import type { SoloKYSession } from '@/types/ky'
import {
    formatHiyariSummary,
    formatRiskSummary,
    getHiyariHattoItems,
    getPastRisks,
    getRecentRisks,
} from '@/lib/historyUtils'

export type DayContext = {
    label: string
    note: string
}

export type WeatherContext = {
    label: string
    note: string
}

const WEEKDAYS = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']

const DAY_CONTEXTS: Record<number, string> = {
    1: '週明けで注意力が低下しがちです',
    5: '週末前で疲労が蓄積しがちです',
}

const WEATHER_CONTEXTS: Record<string, string> = {
    '雨': '滑りやすさと視界不良に注意してください',
    '雪': '足元の凍結や視界不良に注意してください',
    '強風': '飛散物と高所作業に注意してください',
    '猛暑': '熱中症と集中力低下に注意してください',
    '厳寒': '凍結と手元の感覚低下に注意してください',
}

export function getDayContext(date = new Date()): DayContext | null {
    const dayIndex = date.getDay()
    const note = DAY_CONTEXTS[dayIndex]
    if (!note) return null
    return {
        label: WEEKDAYS[dayIndex],
        note,
    }
}

export function getWeatherContext(weather?: string | null): WeatherContext | null {
    const label = (weather ?? '').trim()
    if (!label) return null
    const note = WEATHER_CONTEXTS[label]
    if (!note) return null
    return { label, note }
}

type ContextInjectionOptions = {
    session: SoloKYSession
    userInput?: string
    maxPastRisks?: number
    maxRecentRisks?: number
    maxHiyari?: number
}

export async function buildContextInjection(options: ContextInjectionOptions): Promise<string | null> {
    const {
        session,
        userInput,
        maxPastRisks = 5,
        maxRecentRisks = 3,
        maxHiyari = 3,
    } = options

    const [pastRisks, recentRisks, hiyariItems] = await Promise.all([
        getPastRisks(maxPastRisks, {
            siteName: session.siteName,
            workDescription: userInput,
            excludeSessionId: session.id,
        }),
        getRecentRisks(3, {
            siteName: session.siteName,
            workDescription: userInput,
            excludeSessionId: session.id,
        }),
        getHiyariHattoItems(maxHiyari, {
            siteName: session.siteName,
            excludeSessionId: session.id,
        }),
    ])

    const dayContext = getDayContext(new Date(session.workStartTime))
    const weatherContext = getWeatherContext(session.weather)
    const sections: string[] = []

    if (recentRisks.length > 0) {
        const items = recentRisks.slice(0, maxRecentRisks).map(entry => `- ${formatRiskSummary(entry)}`)
        sections.push([
            '【直近3日以内に同様の危険】',
            items.join('\n'),
            '連日同じ危険が挙がっています。特に注意してください。',
        ].join('\n'))
    }

    if (pastRisks.length > 0) {
        const items = pastRisks.map(entry => `- ${formatRiskSummary(entry)}`)
        sections.push([
            '【過去のKYで挙げられた危険（参考）】',
            items.join('\n'),
        ].join('\n'))
    }

    if (hiyariItems.length > 0) {
        const items = hiyariItems.map(entry => `- ${formatHiyariSummary(entry)}`)
        sections.push([
            '【過去のヒヤリハット】',
            items.join('\n'),
        ].join('\n'))
    }

    const contextLines: string[] = []
    if (dayContext) {
        contextLines.push(`- 曜日: ${dayContext.label}（${dayContext.note}）`)
    }
    if (weatherContext) {
        contextLines.push(`- 天候: ${weatherContext.label}（${weatherContext.note}）`)
    }
    if (contextLines.length > 0) {
        sections.push(['【今日のコンテキスト】', contextLines.join('\n')].join('\n'))
    }

    if (sections.length > 0) {
        sections.push('過去は参考情報です。今日の現場を最優先で確認し、新しい危険がないか必ず検討してください。')
    }

    const injection = sections.join('\n\n').trim()
    if (!injection) return null
    return injection.slice(0, 1200)
}
