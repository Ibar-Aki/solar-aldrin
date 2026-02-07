import { describe, expect, it } from 'vitest'
import { appWithRoutes } from '../../workers/index'

type TestEnv = {
    OPENAI_API_KEY: string
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    WEATHER_API_BASE_URL: string
    API_TOKEN?: string
    REQUIRE_API_TOKEN?: string
    REQUIRE_RATE_LIMIT_KV?: string
    STRICT_CORS?: string
    ALLOWED_ORIGINS?: string
    SENTRY_ENV?: string
}

const baseEnv: TestEnv = {
    OPENAI_API_KEY: 'test-key',
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    WEATHER_API_BASE_URL: '',
}

function metricsRequest(init?: RequestInit): Request {
    return new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        body: JSON.stringify({
            event: 'session_start',
            sessionId: '11111111-1111-4111-8111-111111111111',
            value: 1,
        }),
    })
}

describe('security middleware integration', () => {
    it('本番設定でAPI_TOKEN未設定なら503を返す', async () => {
        const res = await appWithRoutes.fetch(
            metricsRequest(),
            {
                ...baseEnv,
                SENTRY_ENV: 'production',
                REQUIRE_API_TOKEN: '1',
                REQUIRE_RATE_LIMIT_KV: '0',
            }
        )

        expect(res.status).toBe(503)
    })

    it('API_TOKEN設定時にAuthorizationなしなら401を返す', async () => {
        const env: TestEnv = {
            ...baseEnv,
            SENTRY_ENV: 'production',
            REQUIRE_API_TOKEN: '1',
            REQUIRE_RATE_LIMIT_KV: '0',
            API_TOKEN: 'token123',
        }
        const res = await appWithRoutes.fetch(metricsRequest(), env)
        expect(res.status).toBe(401)
    })

    it('STRICT_CORS有効時に未許可Originは403になる', async () => {
        const env: TestEnv = {
            ...baseEnv,
            SENTRY_ENV: 'production',
            REQUIRE_API_TOKEN: '1',
            REQUIRE_RATE_LIMIT_KV: '0',
            STRICT_CORS: '1',
            API_TOKEN: 'token123',
        }
        const res = await appWithRoutes.fetch(
            metricsRequest({
                headers: {
                    Authorization: 'Bearer token123',
                    Origin: 'https://evil.example.com',
                },
            }),
            env
        )
        expect(res.status).toBe(403)
    })

    it('許可Origin + 正しいAuthorizationなら200になる', async () => {
        const env: TestEnv = {
            ...baseEnv,
            SENTRY_ENV: 'production',
            REQUIRE_API_TOKEN: '1',
            REQUIRE_RATE_LIMIT_KV: '0',
            STRICT_CORS: '1',
            ALLOWED_ORIGINS: 'https://trusted.example.com',
            API_TOKEN: 'token123',
        }
        const res = await appWithRoutes.fetch(
            metricsRequest({
                headers: {
                    Authorization: 'Bearer token123',
                    Origin: 'https://trusted.example.com',
                },
            }),
            env
        )
        expect(res.status).toBe(200)
    })

    it('STRICT_CORS有効でもPages固定デプロイURL（hash）Originは許可される', async () => {
        const env: TestEnv = {
            ...baseEnv,
            SENTRY_ENV: 'production',
            REQUIRE_API_TOKEN: '1',
            REQUIRE_RATE_LIMIT_KV: '0',
            STRICT_CORS: '1',
            API_TOKEN: 'token123',
        }
        const res = await appWithRoutes.fetch(
            metricsRequest({
                headers: {
                    Authorization: 'Bearer token123',
                    Origin: 'https://26541138.voice-ky-v2.pages.dev',
                },
            }),
            env
        )
        expect(res.status).toBe(200)
    })

    it('healthは設定不備時にdegradedを返す', async () => {
        const res = await appWithRoutes.fetch(
            new Request('http://localhost/api/health'),
            {
                ...baseEnv,
                SENTRY_ENV: 'production',
                REQUIRE_API_TOKEN: '1',
                REQUIRE_RATE_LIMIT_KV: '1',
            }
        )

        expect(res.status).toBe(503)
        const body = await res.json() as { status: string; issues: string[] }
        expect(body.status).toBe('degraded')
        expect(body.issues).toContain('API_TOKEN_REQUIRED')
        expect(body.issues).toContain('RATE_LIMIT_KV_REQUIRED')
    })
})
