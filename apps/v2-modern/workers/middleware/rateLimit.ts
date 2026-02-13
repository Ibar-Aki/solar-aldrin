/**
 * レート制限ミドルウェア
 * Cloudflare Workers KV を使用
 */
import type { Context, Next } from 'hono'
import { shouldRequireRateLimitKV } from '../lib/securityMode'
import type { KVNamespace, Bindings } from '../types'

export type { KVNamespace }

interface RateLimitConfig {
    windowMs: number      // ウィンドウ時間（ミリ秒）
    maxRequests: number   // 最大リクエスト数
    keyPrefix: string     // KVキーのプレフィックス
}

const defaultConfig: RateLimitConfig = {
    windowMs: 60000,    // 1分
    maxRequests: 30,    // 30回
    keyPrefix: 'rl:',
}

const memoryStore = new Map<string, { count: number; resetAt: number }>()

/**
 * レート制限ミドルウェア（KV / メモリ ハイブリッド）
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
    const cfg = { ...defaultConfig, ...config }

    return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
        if (c.req.path === '/api/health') {
            return next()
        }

        // Cloudflare環境では cf-connecting-ip が信頼できるクライアントIP
        // 開発環境などは x-forwarded-for や unknown にフォールバック
        const ip = c.req.header('cf-connecting-ip') || 'unknown'
        const key = `${cfg.keyPrefix}${ip}`
        const requireKv = shouldRequireRateLimitKV(c.env)

        try {
            // KVが利用可能な場合
            if (c.env.RATE_LIMIT_KV) {
                const current = await c.env.RATE_LIMIT_KV.get(key)
                const count = current ? parseInt(current, 10) : 0

                if (count >= cfg.maxRequests) {
                    c.header('Retry-After', String(Math.ceil(cfg.windowMs / 1000)))
                    return c.json(
                        { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
                        429
                    )
                }

                await c.env.RATE_LIMIT_KV.put(key, String(count + 1), {
                    expirationTtl: Math.ceil(cfg.windowMs / 1000),
                })

                c.header('X-RateLimit-Limit', String(cfg.maxRequests))
                c.header('X-RateLimit-Remaining', String(cfg.maxRequests - count - 1))
            }
            // KVがない場合（メモリフォールバック）
            else {
                if (requireKv) {
                    console.error('RATE_LIMIT_KV is required but not configured')
                    c.header('Retry-After', '5')
                    return c.json(
                        { error: 'レート制限基盤が利用できません。管理者に連絡してください。' },
                        503
                    )
                }
                console.warn('RATE_LIMIT_KV not found. Using memory store (dev only).')
                const now = Date.now()
                let record = memoryStore.get(key)

                if (!record || record.resetAt < now) {
                    record = { count: 0, resetAt: now + cfg.windowMs }
                    memoryStore.set(key, record)
                }

                if (record.count >= cfg.maxRequests) {
                    const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
                    c.header('Retry-After', String(retryAfter))
                    return c.json(
                        { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
                        429
                    )
                }

                record.count++

                c.header('X-RateLimit-Limit', String(cfg.maxRequests))
                c.header('X-RateLimit-Remaining', String(cfg.maxRequests - record.count))
            }
        } catch (e) {
            console.error('Rate limit error:', e)
            if (shouldRequireRateLimitKV(c.env)) {
                c.header('Retry-After', '5')
                return c.json(
                    { error: 'レート制限基盤が利用できません。管理者に連絡してください。' },
                    503
                )
            }
        }

        return next()
    }
}

// rateLimitMemory は廃止し、rateLimit に統合

