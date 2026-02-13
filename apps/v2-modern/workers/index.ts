import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chat } from './routes/chat'
import { rateLimit } from './middleware/rateLimit'
import { withSentry } from '@sentry/cloudflare'
import { metrics } from './routes/metrics'
import { feedback } from './routes/feedback'
import { logError, logInfo } from './observability/logger'
import { captureException } from './observability/sentry'
import { shouldAllowDevOriginWildcards, shouldRequireApiToken, shouldRequireRateLimitKV, shouldUseStrictCors } from './lib/securityMode'
import type { Bindings } from './types'

const app = new Hono<{
    Bindings: Bindings
    Variables: {
        reqId: string
        startTime: number
        tokenFingerprint?: string
    }
}>()

const DEV_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://v2.voice-ky-assistant.pages.dev',
    'https://voice-ky-v2.pages.dev',
]
const PRODUCTION_ALLOWED_ORIGINS = [
    'https://v2.voice-ky-assistant.pages.dev',
    'https://voice-ky-v2.pages.dev',
]

function parseBearerToken(authHeader: string | null | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null
    return authHeader.substring(7).trim() || null
}

function fingerprintToken(token: string): string {
    // 非可逆で短い識別子のみを記録し、原文トークンはログに残さない。
    let hash = 2166136261
    for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i)
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return `tk_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function isAllowedOrigin(
    origin: string | null | undefined,
    envOrigins: string | undefined,
    strictMode: boolean,
    allowDevOriginWildcards: boolean
): boolean {
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

    if (strictMode) {
        if (PRODUCTION_ALLOWED_ORIGINS.includes(origin)) return true

        // Cloudflare Pages の「デプロイごとの固定URL」(例: https://<hash>.<project>.pages.dev) を許可する。
        // 本番運用では STRICT_CORS を有効にしつつ、固定URLでの実機テストも可能にする。
        if (!parsed || parsed.protocol !== 'https:') return false
        const hostname = parsed.hostname.toLowerCase()
        if (hostname.endsWith('.voice-ky-v2.pages.dev')) return true
        if (hostname.endsWith('.voice-ky-assistant.pages.dev')) return true
        return false
    }

    if (DEV_ALLOWED_ORIGINS.includes(origin)) return true
    if (allowDevOriginWildcards) {
        if (origin.endsWith('.voice-ky-assistant.pages.dev')) return true
        if (origin.endsWith('.workers.dev')) return true
        if (origin.endsWith('.ngrok-free.dev')) return true
    }
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
    const tokenFingerprint = (() => {
        const token = parseBearerToken(c.req.header('Authorization'))
        return token ? fingerprintToken(token) : undefined
    })()

    c.set('reqId', reqId)
    c.set('startTime', startTime)
    if (tokenFingerprint) {
        c.set('tokenFingerprint', tokenFingerprint)
    }
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
            tokenFingerprint: c.get('tokenFingerprint'),
        })
    }
})

// Origin拒否（即時403）
app.use('*', async (c, next) => {
    const origin = c.req.header('Origin')
    const strictCors = shouldUseStrictCors(c.env)
    const allowDevOriginWildcards = shouldAllowDevOriginWildcards(c.env)
    if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS, strictCors, allowDevOriginWildcards)) {
        return c.json({ error: 'Forbidden origin', requestId: c.get('reqId') }, 403)
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
    const strictCors = shouldUseStrictCors(c.env)
    const allowDevOriginWildcards = shouldAllowDevOriginWildcards(c.env)
    const corsMiddleware = cors({
        origin: (origin) => {
            if (isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS, strictCors, allowDevOriginWildcards)) {
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
    if (c.req.path === '/api/health') {
        return next()
    }

    const authHeader = c.req.header('Authorization')
    const token = parseBearerToken(authHeader)
    const validToken = c.env.API_TOKEN?.trim()
    const requireApiToken = shouldRequireApiToken(c.env)

    if (requireApiToken && !validToken) {
        logError('auth_config_missing', { reqId: c.get('reqId') })
        return c.json({
            error: 'Server authentication misconfigured',
            code: 'AUTH_CONFIG_MISSING',
            requestId: c.get('reqId'),
        }, 503)
    }

    // 認証任意モードでは Authorization の有無/内容に関わらず認証判定をスキップする。
    // 旧クライアントがBearerを送っても401にせず、移行時の恒常エラーを避ける。
    if (!requireApiToken) {
        return next()
    }

    if (!token) {
        return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', requestId: c.get('reqId') }, 401)
    }

    if (token !== validToken) {
        return c.json({ error: 'Unauthorized', code: 'AUTH_INVALID', requestId: c.get('reqId') }, 401)
    }

    await next()
})

// ヘルスチェック
app.get('/api/health', (c) => {
    const issues: string[] = []

    if (shouldRequireApiToken(c.env) && !c.env.API_TOKEN?.trim()) {
        issues.push('API_TOKEN_REQUIRED')
    }
    if (shouldRequireRateLimitKV(c.env) && !c.env.RATE_LIMIT_KV) {
        issues.push('RATE_LIMIT_KV_REQUIRED')
    }

    if (issues.length > 0) {
        return c.json({ status: 'degraded', version: 'v2', issues }, 503)
    }

    return c.json({ status: 'ok', version: 'v2' })
})

// ルーティングを適用
app.route('/api/chat', chat)
app.route('/api/metrics', metrics)
app.route('/api/feedback', feedback)
const appWithRoutes = app
export { appWithRoutes }

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
