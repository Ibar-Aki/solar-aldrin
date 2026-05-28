import type { SoloKYSession } from '@/types/ky'

export type HistoryDateFilter = 'all' | 'today' | '7d' | '30d'

type HistoryFilterOptions = {
    query: string
    dateFilter: HistoryDateFilter
    now?: Date
}

function normalizeText(value: string | null | undefined): string {
    return (value ?? '').normalize('NFKC').trim().toLowerCase()
}

function sessionSearchText(session: SoloKYSession): string {
    const values: string[] = [
        session.siteName,
        session.userName,
        session.weather,
        session.processPhase ?? '',
        session.healthCondition ?? '',
        session.actionGoal ?? '',
        session.nearMissNote ?? '',
    ]

    for (const item of session.workItems) {
        values.push(item.workDescription ?? '')
        values.push(item.hazardDescription ?? '')
        values.push(...(item.whyDangerous ?? []))
        values.push(...(item.countermeasures ?? []).map((measure) => measure.text))
    }

    return normalizeText(values.join(' '))
}

function getSessionTimestamp(session: SoloKYSession): number {
    return new Date(session.completedAt ?? session.createdAt).getTime()
}

function matchesDateFilter(session: SoloKYSession, filter: HistoryDateFilter, now: Date): boolean {
    if (filter === 'all') return true

    const timestamp = getSessionTimestamp(session)
    if (!Number.isFinite(timestamp)) return false

    if (filter === 'today') {
        const date = new Date(timestamp)
        return date.getFullYear() === now.getFullYear()
            && date.getMonth() === now.getMonth()
            && date.getDate() === now.getDate()
    }

    const days = filter === '7d' ? 7 : 30
    const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000
    return timestamp >= cutoff
}

export function filterSessionsForHistory(
    sessions: SoloKYSession[],
    options: HistoryFilterOptions
): SoloKYSession[] {
    const query = normalizeText(options.query)
    const now = options.now ?? new Date()

    return sessions.filter((session) => {
        if (!matchesDateFilter(session, options.dateFilter, now)) return false
        if (!query) return true
        return sessionSearchText(session).includes(query)
    })
}
