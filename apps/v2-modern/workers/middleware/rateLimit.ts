/**
 * レート制限ミドルウェア
 * Cloudflare Workers KV を使用
 */
import type { Context, Next } from 'hono'
import { shouldRequireRateLimitKV } from '../lib/securityMode'
import { logError, logWarn } from '../observability/logger'
import type { KVNamespace, Bindings } from '../types'

export type { KVNamespace }

interface RateLimitConfig {
    windowMs: number      // ウィンドウ時間（ミリ秒）
    maxRequests: number   // 最大リクエスト数
    keyPrefix: string     // KVキーのプレフィックス
    memoryStoreMaxKeys: number // メモリフォールバック時の最大キー数
}

const defaultConfig: RateLimitConfig = {
    windowMs: 60000,    // 1分
    maxRequests: 30,    // 30回
    keyPrefix: 'rl:',
    memoryStoreMaxKeys: 5000,
}

const memoryStore = new Map<string, { count: number; resetAt: number }>()

function pruneExpiredMemoryStore(now: number): void {
    for (const [storeKey, value] of memoryStore) {
        if (value.resetAt < now) {
            memoryStore.delete(storeKey)
        }
    }
}

function enforceMemoryStoreMaxKeys(maxKeys: number): void {
    while (memoryStore.size > maxKeys) {
        const oldestKey = memoryStore.keys().next().value
        if (!oldestKey) break
        memoryStore.delete(oldestKey)
    }
}

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
                    logError('rate_limit_kv_required_missing', {
                        path: c.req.path,
                        method: c.req.method,
                    })
                    c.header('Retry-After', '5')
                    return c.json(
                        { error: 'レート制限基盤が利用できません。管理者に連絡してください。' },
                        503
                    )
                }
                logWarn('rate_limit_memory_fallback_active', {
                    path: c.req.path,
                    method: c.req.method,
                })
                const now = Date.now()
                pruneExpiredMemoryStore(now)
                let record = memoryStore.get(key)

                if (!record || record.resetAt < now) {
                    record = { count: 0, resetAt: now + cfg.windowMs }
                    memoryStore.set(key, record)
                    enforceMemoryStoreMaxKeys(cfg.memoryStoreMaxKeys)
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
            logError('rate_limit_middleware_error', {
                message: e instanceof Error ? e.message : String(e),
            })
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
