import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { rateLimit, type KVNamespace } from '../../workers/middleware/rateLimit'

type Env = {
    RATE_LIMIT_KV?: KVNamespace
    SENTRY_ENV?: string
    ENVIRONMENT?: string
    REQUIRE_RATE_LIMIT_KV?: string
}

function createApp() {
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', rateLimit({ maxRequests: 2, windowMs: 60_000 }))
    app.get('/', (c) => c.text('ok'))
    return app
}

function createInMemoryKV(): KVNamespace {
    const store = new Map<string, string>()
    return {
        async get(key: string) {
            return store.get(key) ?? null
        },
        async put(key: string, value: string) {
            store.set(key, value)
        },
    }
}

describe('rateLimit middleware', () => {
    it('本番でKV必須時に未設定なら503で遮断する', async () => {
        const app = createApp()
        const res = await app.fetch(new Request('http://localhost/'), {
            SENTRY_ENV: 'production',
            REQUIRE_RATE_LIMIT_KV: '1',
        })

        expect(res.status).toBe(503)
    })

    it('開発環境ではKV未設定でもメモリフォールバックで通過する', async () => {
        const app = createApp()
        const res = await app.fetch(new Request('http://localhost/'), {
            SENTRY_ENV: 'local',
            REQUIRE_RATE_LIMIT_KV: '0',
        })

        expect(res.status).toBe(200)
    })

    it('KV利用時に上限超過で429を返す', async () => {
        const app = createApp()
        const env = {
            RATE_LIMIT_KV: createInMemoryKV(),
            SENTRY_ENV: 'production',
            REQUIRE_RATE_LIMIT_KV: '1',
        }

        const req = () => new Request('http://localhost/', {
            headers: { 'cf-connecting-ip': '1.2.3.4' },
        })

        expect((await app.fetch(req(), env)).status).toBe(200)
        expect((await app.fetch(req(), env)).status).toBe(200)
        expect((await app.fetch(req(), env)).status).toBe(429)
    })

    it('メモリフォールバック時にキー数上限を超えた古いキーは退避される', async () => {
        const app = new Hono<{ Bindings: Env }>()
        app.use('*', rateLimit({ maxRequests: 1, windowMs: 60_000, memoryStoreMaxKeys: 2 }))
        app.get('/', (c) => c.text('ok'))

        const env = {
            SENTRY_ENV: 'local',
            REQUIRE_RATE_LIMIT_KV: '0',
        }

        const req = (ip: string) => new Request('http://localhost/', {
            headers: { 'cf-connecting-ip': ip },
        })

        expect((await app.fetch(req('10.0.0.1'), env)).status).toBe(200)
        expect((await app.fetch(req('10.0.0.2'), env)).status).toBe(200)
        expect((await app.fetch(req('10.0.0.3'), env)).status).toBe(200)
        // 上限2件のため、最初のキーは退避され、再度200になる。
        expect((await app.fetch(req('10.0.0.1'), env)).status).toBe(200)
    })
})
