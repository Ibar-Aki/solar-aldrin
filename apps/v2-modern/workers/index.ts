import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chat } from './routes/chat'
import { rateLimit, type KVNamespace } from './middleware/rateLimit'
import { withSentry } from '@sentry/cloudflare'
import { metrics, type AnalyticsEngineDataset } from './routes/metrics'
import { feedback } from './routes/feedback'
import { logError, logInfo } from './observability/logger'
import { captureException } from './observability/sentry'

type Bindings = {
    OPENAI_API_KEY: string
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    WEATHER_API_BASE_URL: string
    RATE_LIMIT_KV?: KVNamespace
    FEEDBACK_KV?: KVNamespace
    ASSETS?: { fetch: (request: Request) => Promise<Response> }
    API_TOKEN?: string
    ALLOWED_ORIGINS?: string
    SENTRY_DSN?: string
    SENTRY_ENV?: string
    SENTRY_RELEASE?: string
    ANALYTICS_DATASET?: AnalyticsEngineDataset
    ENABLE_FEEDBACK?: string
}

const app = new Hono<{
    Bindings: Bindings
    Variables: {
        reqId: string
        startTime: number
    }
}>()

// デフォルトの許可オリジン
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://v2.voice-ky-assistant.pages.dev',
]

function isAllowedOrigin(origin: string | null | undefined, envOrigins?: string): boolean {
    if (!origin) return true

    const isPrivateIpv4 = (hostname: string): boolean => {
        const parts = hostname.split('.').map(part => Number(part))
        if (parts.length !== 4 || parts.some(part => Number.isNaN(part))) return false
        const [a, b] = parts
        if (a === 10) return true
        if (a === 192 && b === 168) return true
        if (a === 172 && b >= 16 && b <= 31) return true
        return false
    }

    const isLocalHost = (hostname: string): boolean =>
        hostname === 'localhost' || hostname === '127.0.0.1'

    const parsed = (() => {
        try {
            return new URL(origin)
        } catch {
            return null
        }
    })()

    const envList = envOrigins
        ? envOrigins.split(',').map(o => o.trim()).filter(Boolean)
        : []

    if (envList.includes(origin)) return true
    if (DEFAULT_ALLOWED_ORIGINS.includes(origin)) return true
    if (origin.endsWith('.voice-ky-assistant.pages.dev')) return true
    if (origin.endsWith('.workers.dev')) return true
    if (origin.endsWith('.ngrok-free.dev')) return true
    if (origin.startsWith('http://localhost:')) return true
    if (parsed) {
        if (isLocalHost(parsed.hostname)) return true
        if (isPrivateIpv4(parsed.hostname)) return true
    }
    return false
}

// リクエストID付与 + 構造化ログ
app.use('*', async (c, next) => {
    const reqId = c.req.header('x-request-id') ?? crypto.randomUUID()
    const startTime = Date.now()

    c.set('reqId', reqId)
    c.set('startTime', startTime)
    c.header('x-request-id', reqId)

    try {
        await next()
    } finally {
        const latencyMs = Date.now() - startTime
        logInfo('request', {
            reqId,
            method: c.req.method,
            path: c.req.path,
            status: c.res?.status ?? 0,
            latencyMs,
        })
    }
})

// Origin拒否（即時403）
app.use('*', async (c, next) => {
    const origin = c.req.header('Origin')
    if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
        return c.json({ error: 'Forbidden origin' }, 403)
    }
    return next()
})

// グローバルエラーハンドラ
app.onError((err, c) => {
    const reqId = c.get('reqId')
    logError('unhandled_error', {
        reqId,
        message: err instanceof Error ? err.message : 'unknown_error',
    })
    captureException(err, { reqId })
    return c.json({ error: 'Internal Server Error' }, 500)
})

// CORS設定
app.use('*', async (c, next) => {
    const corsMiddleware = cors({
        origin: (origin) => {
            if (isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
                return origin ?? ''
            }
            return ''
        },
        credentials: true,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    })
    return corsMiddleware(c, next)
})

// レート制限（全API）- 1分あたり30回
app.use('/api/*', rateLimit({ maxRequests: 30, windowMs: 60000 }))

// API認証ミドルウェア
app.use('/api/*', async (c, next) => {
    // ヘルスチェックは除外
    if (c.req.path === '/api/health' || c.req.path === '/api/metrics') {
        return next()
    }

    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    // 環境変数に設定された正規のトークン（未設定ならチェックしない＝開発中など）
    const validToken = c.env.API_TOKEN

    if (validToken && token !== validToken) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    await next()
})

// ヘルスチェック
app.get('/api/health', (c) => {
    return c.json({ status: 'ok', version: 'v2' })
})

// ルーティングを適用
app.route('/api/chat', chat)
app.route('/api/metrics', metrics)
app.route('/api/feedback', feedback)
const appWithRoutes = app

// クライアント側で使う型定義をエクスポート
export type AppType = typeof appWithRoutes

type AppFetchContext = Parameters<typeof appWithRoutes.fetch>[2]

const sentryHandler = {
    fetch: (request: Request, env: Bindings, ctx: AppFetchContext) => appWithRoutes.fetch(request, env, ctx),
}

export default withSentry(
    (env: Bindings) => ({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENV ?? 'unknown',
        release: env.SENTRY_RELEASE,
        tracesSampleRate: 0,
    }),
    sentryHandler,
)
