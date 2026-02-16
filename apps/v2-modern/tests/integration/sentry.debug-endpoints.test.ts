import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/cloudflare', async () => {
    return {
        withSentry: (_options: unknown, handler: { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> }) => handler,
        startSpan: async (_options: unknown, callback: () => Promise<unknown>) => callback(),
        withScope: (callback: (scope: { setTag: (key: string, value: string) => void }) => void) => {
            callback({
                setTag: () => undefined,
            })
        },
        captureException: () => undefined,
    }
})

import { appWithRoutes } from '../../workers/index'

type MinimalEnv = {
    OPENAI_API_KEY: string
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    WEATHER_API_BASE_URL: string
    ENABLE_SENTRY_TEST_ENDPOINT?: string
    SENTRY_TEST_TOKEN?: string
}

function baseEnv(overrides: Partial<MinimalEnv> = {}): MinimalEnv {
    return {
        OPENAI_API_KEY: 'test-openai-key',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        WEATHER_API_BASE_URL: 'https://example.weather.local',
        ...overrides,
    }
}

describe('Sentry debug endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('ENABLE_SENTRY_TEST_ENDPOINT 未設定時は 404 を返す', async () => {
        const req = new Request('http://localhost/api/debug/sentry-test-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'boom', testId: 't-1' }),
        })
        const res = await appWithRoutes.fetch(req, baseEnv(), {})
        expect(res.status).toBe(404)
    })

    it('有効化時はバックエンド例外を意図的に発生させ、500 を返す', async () => {
        const req = new Request('http://localhost/api/debug/sentry-test-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'boom', testId: 't-2' }),
        })
        const res = await appWithRoutes.fetch(req, baseEnv({
            ENABLE_SENTRY_TEST_ENDPOINT: '1',
        }), {})
        expect(res.status).toBe(500)
    })

    it('SENTRY_TEST_TOKEN 設定時は x-sentry-test-token が必須になる', async () => {
        const env = baseEnv({
            ENABLE_SENTRY_TEST_ENDPOINT: '1',
            SENTRY_TEST_TOKEN: 'secret-token',
        })

        const noHeaderReq = new Request('http://localhost/api/debug/sentry-test-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'boom', testId: 't-3' }),
        })
        const noHeaderRes = await appWithRoutes.fetch(noHeaderReq, env, {})
        expect(noHeaderRes.status).toBe(403)

        const okReq = new Request('http://localhost/api/debug/sentry-test-error', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-sentry-test-token': 'secret-token',
            },
            body: JSON.stringify({ message: 'boom', testId: 't-4' }),
        })
        const okRes = await appWithRoutes.fetch(okReq, env, {})
        expect(okRes.status).toBe(500)
    })

    it('trace endpoint は sentry-trace / baggage をエコーする', async () => {
        const req = new Request('http://localhost/api/debug/sentry-test-trace?testId=t-5&workMs=5', {
            headers: {
                'sentry-trace': '0123456789abcdef0123456789abcdef-0123456789abcdef-1',
                baggage: 'sentry-environment=test',
            },
        })
        const res = await appWithRoutes.fetch(req, baseEnv({
            ENABLE_SENTRY_TEST_ENDPOINT: '1',
        }), {})

        expect(res.status).toBe(200)
        expect(res.headers.get('x-sentry-trace')).toBe('0123456789abcdef0123456789abcdef-0123456789abcdef-1')
        expect(res.headers.get('x-sentry-baggage')).toBe('sentry-environment=test')

        const body = await res.json() as { ok?: boolean; testId?: string; workMs?: number }
        expect(body.ok).toBe(true)
        expect(body.testId).toBe('t-5')
        expect(body.workMs).toBe(5)
    })

    it('CORS preflight で sentry 関連ヘッダが許可される', async () => {
        const req = new Request('http://localhost/api/debug/sentry-test-trace', {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost:5173',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'sentry-trace,baggage,x-sentry-test-token',
            },
        })
        const res = await appWithRoutes.fetch(req, baseEnv(), {})

        expect(res.status).toBeGreaterThanOrEqual(200)
        expect(res.status).toBeLessThan(300)

        const allowHeaders = (res.headers.get('Access-Control-Allow-Headers') || '').toLowerCase()
        expect(allowHeaders).toContain('sentry-trace')
        expect(allowHeaders).toContain('baggage')
        expect(allowHeaders).toContain('x-sentry-test-token')
    })
})
