import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chat } from './routes/chat'
import { rateLimitMemory } from './middleware/rateLimit'

type Bindings = {
    OPENAI_API_KEY: string
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    WEATHER_API_BASE_URL: string
    RATE_LIMIT_KV?: KVNamespace
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

// レート制限（チャットAPI）
app.use('/api/chat/*', rateLimitMemory({ maxRequests: 10, windowMs: 60000 }))

// ヘルスチェック
app.get('/api/health', (c) => {
    return c.json({ status: 'ok', version: 'v2' })
})

// チャットルート
app.route('/api/chat', chat)

// エラーハンドリング
app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'Internal server error' }, 500)
})

// 404
app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404)
})

export default app
