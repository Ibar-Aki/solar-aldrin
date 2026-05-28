import { logWarn } from '../observability/logger'
import type { Bindings } from '../types'

export type UsageWarning = {
    code: string
    message: string
}

type DailyUsageRecord = {
    requests: number
    tokens: number
    updatedAt: string
}

type TrackDailyUsageOptions = {
    env: Bindings
    clientId?: string | null
    endpoint: 'chat' | 'feedback'
    tokenCount?: number
    reqId?: string
    now?: Date
}

const DEFAULT_DAILY_USAGE_SOFT_REQUEST_LIMIT = 50
const DEFAULT_DAILY_USAGE_SOFT_TOKEN_LIMIT = 30000
const USAGE_TTL_SECONDS = 60 * 60 * 48
const memoryUsage = new Map<string, DailyUsageRecord>()

function parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = raw ? Number.parseInt(raw.trim(), 10) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sanitizeClientId(raw: string | undefined | null): string {
    const value = (raw ?? '').trim()
    if (!value) return 'anonymous'
    return value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'anonymous'
}

function getUsageKey(clientId: string, now: Date): string {
    return `daily-usage:${now.toISOString().slice(0, 10)}:${clientId}`
}

function parseRecord(raw: string | null): DailyUsageRecord {
    if (!raw) return { requests: 0, tokens: 0, updatedAt: new Date(0).toISOString() }
    try {
        const parsed = JSON.parse(raw) as Partial<DailyUsageRecord>
        return {
            requests: typeof parsed.requests === 'number' ? parsed.requests : 0,
            tokens: typeof parsed.tokens === 'number' ? parsed.tokens : 0,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        }
    } catch {
        return { requests: 0, tokens: 0, updatedAt: new Date(0).toISOString() }
    }
}

function buildWarning(record: DailyUsageRecord, env: Bindings): UsageWarning | undefined {
    const requestLimit = parsePositiveInt(env.DAILY_USAGE_SOFT_REQUEST_LIMIT, DEFAULT_DAILY_USAGE_SOFT_REQUEST_LIMIT)
    const tokenLimit = parsePositiveInt(env.DAILY_USAGE_SOFT_TOKEN_LIMIT, DEFAULT_DAILY_USAGE_SOFT_TOKEN_LIMIT)

    if (record.requests > requestLimit) {
        return {
            code: 'DAILY_REQUEST_SOFT_LIMIT_EXCEEDED',
            message: '本日の利用回数が目安を超えています。必要な利用に絞ってください。',
        }
    }
    if (record.tokens > tokenLimit) {
        return {
            code: 'DAILY_TOKEN_SOFT_LIMIT_EXCEEDED',
            message: '本日のAI使用量が目安を超えています。長い会話を控えめにしてください。',
        }
    }
    return undefined
}

export function shouldHardBlockDailyUsage(env: Bindings): boolean {
    return env.DAILY_USAGE_HARD_BLOCK === '1'
}

export async function trackDailyUsage(options: TrackDailyUsageOptions): Promise<UsageWarning | undefined> {
    const now = options.now ?? new Date()
    const clientId = sanitizeClientId(options.clientId)
    const key = getUsageKey(clientId, now)
    const tokenCount = Math.max(0, Math.floor(options.tokenCount ?? 0))

    const current = options.env.RATE_LIMIT_KV
        ? parseRecord(await options.env.RATE_LIMIT_KV.get(key))
        : (memoryUsage.get(key) ?? { requests: 0, tokens: 0, updatedAt: new Date(0).toISOString() })

    const next: DailyUsageRecord = {
        requests: current.requests + 1,
        tokens: current.tokens + tokenCount,
        updatedAt: now.toISOString(),
    }

    if (options.env.RATE_LIMIT_KV) {
        await options.env.RATE_LIMIT_KV.put(key, JSON.stringify(next), { expirationTtl: USAGE_TTL_SECONDS })
    } else {
        memoryUsage.set(key, next)
    }

    const warning = buildWarning(next, options.env)
    if (warning) {
        logWarn('daily_usage_soft_limit_exceeded', {
            reqId: options.reqId,
            endpoint: options.endpoint,
            clientId,
            requests: next.requests,
            tokens: next.tokens,
            code: warning.code,
            hardBlockEnabled: shouldHardBlockDailyUsage(options.env),
        })
    }
    return warning
}

export function resetDailyUsageMemory(): void {
    memoryUsage.clear()
}
