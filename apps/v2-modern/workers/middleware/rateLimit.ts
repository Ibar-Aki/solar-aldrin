/**
 * レート制限ミドルウェア
 * Cloudflare Workers KV を使用
 */
import { Context, Next } from 'hono'

interface RateLimitConfig {
    windowMs: number      // ウィンドウ時間（ミリ秒）
    maxRequests: number   // 最大リクエスト数
    keyPrefix: string     // KVキーのプレフィックス
}

type Bindings = {
    RATE_LIMIT_KV?: KVNamespace
}

const defaultConfig: RateLimitConfig = {
    windowMs: 60000,    // 1分
    maxRequests: 10,    // 10回
    keyPrefix: 'rl:',
}

/**
 * IPベースのレート制限ミドルウェア
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
    const cfg = { ...defaultConfig, ...config }

    return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
        // KVが設定されていない場合はスキップ（開発環境用）
        if (!c.env.RATE_LIMIT_KV) {
            console.warn('RATE_LIMIT_KV not configured, skipping rate limit')
            return next()
        }

        const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
        const key = `${cfg.keyPrefix}${ip}`

        try {
            const current = await c.env.RATE_LIMIT_KV.get(key)
            const count = current ? parseInt(current, 10) : 0

            if (count >= cfg.maxRequests) {
                return c.json(
                    { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
                    429
                )
            }

            // カウントを増やす（TTL付き）
            await c.env.RATE_LIMIT_KV.put(key, String(count + 1), {
                expirationTtl: Math.ceil(cfg.windowMs / 1000),
            })

            // レート制限ヘッダーを追加
            c.header('X-RateLimit-Limit', String(cfg.maxRequests))
            c.header('X-RateLimit-Remaining', String(cfg.maxRequests - count - 1))

        } catch (e) {
            console.error('Rate limit error:', e)
            // エラー時はリクエストを許可（可用性優先）
        }

        return next()
    }
}

/**
 * 簡易版レート制限（KVなし、メモリベース）
 * 注意: Workers間で共有されないため、開発用
 */
const memoryStore = new Map<string, { count: number; resetAt: number }>()

export function rateLimitMemory(config: Partial<RateLimitConfig> = {}) {
    const cfg = { ...defaultConfig, ...config }

    return async (c: Context, next: Next) => {
        const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
        const key = `${cfg.keyPrefix}${ip}`
        const now = Date.now()

        let record = memoryStore.get(key)

        // 期限切れならリセット
        if (!record || record.resetAt < now) {
            record = { count: 0, resetAt: now + cfg.windowMs }
            memoryStore.set(key, record)
        }

        if (record.count >= cfg.maxRequests) {
            return c.json(
                { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
                429
            )
        }

        record.count++

        c.header('X-RateLimit-Limit', String(cfg.maxRequests))
        c.header('X-RateLimit-Remaining', String(cfg.maxRequests - record.count))

        return next()
    }
}
