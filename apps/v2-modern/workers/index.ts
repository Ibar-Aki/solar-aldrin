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
}

const app = new Hono<{ Bindings: Bindings }>()

// 許可するオリジン
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://v2.voice-ky-assistant.pages.dev',
]

// CORS設定
app.use('*', cors({
    origin: (origin) => {
        // 許可リストに含まれているか
        if (ALLOWED_ORIGINS.includes(origin ?? '')) {
            return origin ?? ''
        }
        // Cloudflare Pagesのプレビュー・プロダクションURL
        if (origin?.endsWith('.voice-ky-assistant.pages.dev')) {
            return origin
        }
        if (origin?.endsWith('.workers.dev')) {
            return origin
        }
        // 開発環境のlocalhostを許可
        if (origin?.startsWith('http://localhost:')) {
            return origin
        }
        return ''
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
}))

// レート制限（全API）
app.use('/api/*', rateLimit({ maxRequests: 20, windowMs: 60000 }))

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

// 既存の app 変数宣言の後に追加
const route = app.route('/api/chat', chat)

// クライアント側で使う型定義をエクスポート
export type AppType = typeof route

export default app
