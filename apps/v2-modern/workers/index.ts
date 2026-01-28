import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chat } from './routes/chat'
import { rateLimit, type KVNamespace } from './middleware/rateLimit'

type Bindings = {
    OPENAI_API_KEY: string
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    WEATHER_API_BASE_URL: string
    RATE_LIMIT_KV?: KVNamespace
    ASSETS?: { fetch: (request: Request) => Promise<Response> }
    API_TOKEN?: string
    ALLOWED_ORIGINS?: string
}

const app = new Hono<{ Bindings: Bindings }>()

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
    if (origin.startsWith('http://localhost:')) return true
    if (parsed) {
        if (isLocalHost(parsed.hostname)) return true
        if (isPrivateIpv4(parsed.hostname)) return true
    }
    return false
}

// Origin拒否（即時403）
app.use('*', async (c, next) => {
    const origin = c.req.header('Origin')
    if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
        return c.json({ error: 'Forbidden origin' }, 403)
    }
    return next()
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
    if (c.req.path === '/api/health') {
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
const appWithRoutes = app.route('/api/chat', chat)

// クライアント側で使う型定義をエクスポート
export type AppType = typeof appWithRoutes

export default appWithRoutes
