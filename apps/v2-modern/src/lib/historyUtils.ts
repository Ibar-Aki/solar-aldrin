import type { SoloKYSession } from '@/types/ky'
import { db } from '@/lib/db'

const RETENTION_DAYS = 90
const MAX_SESSIONS = 100
const DEFAULT_PAST_RISK_DAYS = 30
const DEFAULT_RECENT_DAYS = 3
const MAX_SUMMARY_LENGTH = 50

export type RiskEntry = {
    risk: string
    workDescription: string | null
    date: string
    siteName: string
    sessionId: string
}

export type HiyariHattoEntry = {
    note: string
    date: string
    siteName: string
    sessionId: string
}

export type RecentRiskMatch = {
    risk: string
    date: string
    daysAgo: number
}

type RiskQueryOptions = {
    siteName?: string
    workDescription?: string
    excludeSessionId?: string
    withinDays?: number
}

let retentionApplied = false

function toDateLabel(iso: string): string {
    return iso.slice(0, 10)
}

function truncateText(text: string, maxLength: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    if (maxLength <= 3) return normalized.slice(0, maxLength)
    return `${normalized.slice(0, maxLength - 3)}...`
}

function normalizeText(value?: string | null): string {
    return (value ?? '').trim().toLowerCase()
}

function isSimilarText(target: string, query?: string): boolean {
    if (!query) return true
    const t = normalizeText(target)
    const q = normalizeText(query)
    if (!t || !q) return true
    if (t.includes(q) || q.includes(t)) return true

    const tokens = q.split(/[[\]\s/、,，・()（）「」『』【】]+/).filter(token => token.length >= 2)
    return tokens.some(token => t.includes(token))
}

function getSessionDate(session: SoloKYSession): string {
    return session.completedAt ?? session.createdAt
}

function withinDays(dateIso: string, days: number): boolean {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return new Date(dateIso).getTime() >= cutoff
}

function diffDays(from: Date, to: Date): number {
    const diffMs = from.getTime() - to.getTime()
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)))
}

async function getAllSessionsSorted(): Promise<SoloKYSession[]> {
    await applyHistoryRetention()
    return db.sessions.orderBy('createdAt').reverse().toArray()
}

function matchesSession(session: SoloKYSession, options: RiskQueryOptions): boolean {
    if (options.excludeSessionId && session.id === options.excludeSessionId) return false

    if (options.siteName && !isSimilarText(session.siteName, options.siteName)) {
        return false
    }

    if (options.workDescription) {
        const matchesWork = session.workItems.some(item =>
            isSimilarText(item.workDescription, options.workDescription) ||
            isSimilarText(item.hazardDescription, options.workDescription)
        )
        if (!matchesWork) return false
    }

    return true
}

function extractRisks(session: SoloKYSession): RiskEntry[] {
    const date = getSessionDate(session)
    return session.workItems
        .filter(item => item.hazardDescription)
        .map(item => ({
            risk: item.hazardDescription,
            workDescription: item.workDescription ?? null,
            date,
            siteName: session.siteName,
            sessionId: session.id,
        }))
}

function dedupeRisks(entries: RiskEntry[]): RiskEntry[] {
    const seen = new Set<string>()
    const result: RiskEntry[] = []
    for (const entry of entries) {
        const key = normalizeText(entry.risk)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(entry)
    }
    return result
}

export async function applyHistoryRetention(): Promise<void> {
    if (retentionApplied) return

    try {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
        const cutoffIso = cutoff.toISOString()

        const oldKeys = await db.sessions.where('createdAt').below(cutoffIso).primaryKeys()
        if (oldKeys.length > 0) {
            await db.sessions.bulkDelete(oldKeys)
        }

        const count = await db.sessions.count()
        if (count > MAX_SESSIONS) {
            const deleteCount = count - MAX_SESSIONS
            const excessKeys = await db.sessions.orderBy('createdAt').limit(deleteCount).primaryKeys()
            if (excessKeys.length > 0) {
                await db.sessions.bulkDelete(excessKeys)
            }
        }
    } catch (error) {
        console.warn('History retention failed:', error)
    } finally {
        retentionApplied = true
    }
}

export function resetRetentionState() {
    retentionApplied = false
}

export async function getRecentSessions(days: number): Promise<SoloKYSession[]> {
    const sessions = await getAllSessionsSorted()
    return sessions.filter(session => withinDays(getSessionDate(session), days))
}

export async function getPastRisks(limit = 5, options: RiskQueryOptions = {}): Promise<RiskEntry[]> {
    const within = options.withinDays ?? DEFAULT_PAST_RISK_DAYS
    const sessions = await getAllSessionsSorted()
    const filtered = sessions.filter(session =>
        withinDays(getSessionDate(session), within) && matchesSession(session, options)
    )

    const risks = dedupeRisks(filtered.flatMap(extractRisks))
    return risks.slice(0, limit)
}

export async function getRecentRisks(days = DEFAULT_RECENT_DAYS, options: RiskQueryOptions = {}): Promise<RiskEntry[]> {
    const within = options.withinDays ?? days
    const sessions = await getAllSessionsSorted()
    const filtered = sessions.filter(session =>
        withinDays(getSessionDate(session), within) && matchesSession(session, options)
    )

    return dedupeRisks(filtered.flatMap(extractRisks))
}

export async function getHiyariHattoItems(limit = 3, options: RiskQueryOptions = {}): Promise<HiyariHattoEntry[]> {
    const within = options.withinDays ?? DEFAULT_PAST_RISK_DAYS
    const sessions = await getAllSessionsSorted()
    const filtered = sessions.filter(session =>
        withinDays(getSessionDate(session), within) &&
        session.hadNearMiss &&
        session.nearMissNote &&
        matchesSession(session, options)
    )

    return filtered
        .map(session => ({
            note: session.nearMissNote ?? '',
            date: getSessionDate(session),
            siteName: session.siteName,
            sessionId: session.id,
        }))
        .filter(entry => entry.note.trim().length > 0)
        .slice(0, limit)
}

export function formatRiskSummary(entry: RiskEntry, maxLength = MAX_SUMMARY_LENGTH): string {
    const dateLabel = toDateLabel(entry.date)
    const suffix = ` (${dateLabel})`
    const allowed = Math.max(0, maxLength - suffix.length)
    const riskText = truncateText(entry.risk, allowed)
    return `${riskText}${suffix}`
}

export function formatHiyariSummary(entry: HiyariHattoEntry, maxLength = MAX_SUMMARY_LENGTH): string {
    const dateLabel = toDateLabel(entry.date)
    const suffix = ` (${dateLabel})`
    const allowed = Math.max(0, maxLength - suffix.length)
    const note = truncateText(entry.note, allowed)
    return `${note}${suffix}`
}

export async function getRecentRiskMatches(
    session: SoloKYSession,
    days = DEFAULT_RECENT_DAYS
): Promise<RecentRiskMatch[]> {
    const recentRisks = await getRecentRisks(days, {
        siteName: session.siteName,
        excludeSessionId: session.id,
    })

    const baseDate = new Date(getSessionDate(session))
    const matches: RecentRiskMatch[] = []
    const seen = new Set<string>()

    for (const item of session.workItems) {
        const hazard = item.hazardDescription?.trim()
        if (!hazard) continue
        const key = normalizeText(hazard)
        if (seen.has(key)) continue

        const matched = recentRisks.find(riskEntry => isSimilarText(riskEntry.risk, hazard))
        if (!matched) continue

        const daysAgo = diffDays(baseDate, new Date(matched.date))
        matches.push({ risk: hazard, date: matched.date, daysAgo })
        seen.add(key)
    }

    return matches.sort((a, b) => a.daysAgo - b.daysAgo)
}
