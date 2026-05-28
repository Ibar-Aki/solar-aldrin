import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    resetDailyUsageMemory,
    shouldHardBlockDailyUsage,
    trackDailyUsage,
} from '../../workers/lib/usageTracking'
import type { Bindings, KVNamespace } from '../../workers/types'

function baseEnv(overrides: Partial<Bindings> = {}): Bindings {
    return {
        OPENAI_API_KEY: 'test-key',
        SUPABASE_URL: '',
        SUPABASE_ANON_KEY: '',
        WEATHER_API_BASE_URL: '',
        ...overrides,
    }
}

function createMemoryKV(): KVNamespace {
    const store = new Map<string, string>()
    return {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
            store.set(key, value)
        }),
    }
}

describe('daily usage soft tracking', () => {
    beforeEach(() => {
        resetDailyUsageMemory()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('soft request limitを超えても警告だけを返す', async () => {
        const env = baseEnv({
            DAILY_USAGE_SOFT_REQUEST_LIMIT: '1',
            DAILY_USAGE_SOFT_TOKEN_LIMIT: '999',
        })

        const first = await trackDailyUsage({
            env,
            clientId: 'client-a',
            endpoint: 'chat',
            tokenCount: 10,
            now: new Date('2026-01-01T00:00:00.000Z'),
        })
        const second = await trackDailyUsage({
            env,
            clientId: 'client-a',
            endpoint: 'chat',
            tokenCount: 10,
            now: new Date('2026-01-01T00:01:00.000Z'),
        })

        expect(first).toBeUndefined()
        expect(second).toEqual({
            code: 'DAILY_REQUEST_SOFT_LIMIT_EXCEEDED',
            message: '本日の利用回数が目安を超えています。必要な利用に絞ってください。',
        })
    })

    it('KVがあれば日次使用量をKVに保存する', async () => {
        const kv = createMemoryKV()
        const env = baseEnv({ RATE_LIMIT_KV: kv })

        await trackDailyUsage({
            env,
            clientId: 'client-a',
            endpoint: 'feedback',
            tokenCount: 12,
            now: new Date('2026-01-01T00:00:00.000Z'),
        })

        expect(kv.put).toHaveBeenCalled()
    })

    it('hard blockはデフォルト無効で、明示設定時だけ有効になる', () => {
        expect(shouldHardBlockDailyUsage(baseEnv())).toBe(false)
        expect(shouldHardBlockDailyUsage(baseEnv({ DAILY_USAGE_HARD_BLOCK: '1' }))).toBe(true)
    })
})
