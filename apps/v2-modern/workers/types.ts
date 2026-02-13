/**
 * Workers 共通型定義
 * Bindings / KVNamespace / AnalyticsEngineDataset を一元管理
 */

/**
 * Cloudflare Workers KV Namespace インターフェイス
 * ライブラリ依存を避けるためのシンプルな型定義
 */
export interface KVNamespace {
    get(key: string, options?: unknown): Promise<string | null>
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

/**
 * Cloudflare Analytics Engine Dataset
 */
export type AnalyticsEngineDataset = {
    writeDataPoint: (data: {
        indexes?: string[]
        doubles?: number[]
        blobs?: string[]
    }) => void
}

/**
 * Workers 環境変数バインディング
 * 全ルート / ミドルウェアで共有する統合型
 */
export type Bindings = {
    // === AI Provider ===
    OPENAI_API_KEY: string
    GEMINI_API_KEY?: string
    AI_PROVIDER?: string
    AI_MODEL?: string
    GEMINI_MODEL?: string
    OPENAI_MODEL?: string
    ENABLE_PROVIDER_FALLBACK?: string
    ENABLE_CONTEXT_INJECTION?: string

    // === AI Runtime Config ===
    OPENAI_TIMEOUT_MS?: string
    OPENAI_RETRY_COUNT?: string
    OPENAI_MAX_TOKENS?: string
    GEMINI_TIMEOUT_MS?: string
    GEMINI_RETRY_COUNT?: string
    GEMINI_MAX_TOKENS?: string

    // === External Services ===
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    WEATHER_API_BASE_URL: string

    // === Cloudflare Bindings ===
    RATE_LIMIT_KV?: KVNamespace
    FEEDBACK_KV?: KVNamespace
    ASSETS?: { fetch: (request: Request) => Promise<Response> }
    ANALYTICS_DATASET?: AnalyticsEngineDataset

    // === Security / Auth ===
    API_TOKEN?: string
    ALLOWED_ORIGINS?: string
    REQUIRE_API_TOKEN?: string
    REQUIRE_RATE_LIMIT_KV?: string
    STRICT_CORS?: string

    // === Observability ===
    SENTRY_DSN?: string
    SENTRY_ENV?: string
    SENTRY_RELEASE?: string
    AI_POLICY_VERSION?: string
    ENVIRONMENT?: string

    // === Feature Flags ===
    ENABLE_FEEDBACK?: string
}
