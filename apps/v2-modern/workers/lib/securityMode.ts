type SecurityEnv = {
    SENTRY_ENV?: string
    ENVIRONMENT?: string
    REQUIRE_API_TOKEN?: string
    REQUIRE_RATE_LIMIT_KV?: string
    STRICT_CORS?: string
    ALLOW_DEV_ORIGIN_WILDCARDS?: string
}

function parseBooleanFlag(value?: string): boolean | null {
    if (value === undefined) return null

    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    return null
}

export function isProductionEnv(env: Pick<SecurityEnv, 'SENTRY_ENV' | 'ENVIRONMENT'>): boolean {
    const envName = (env.ENVIRONMENT ?? env.SENTRY_ENV ?? '').trim().toLowerCase()
    return envName === 'production' || envName === 'prod'
}

export function shouldRequireApiToken(env: SecurityEnv): boolean {
    const explicit = parseBooleanFlag(env.REQUIRE_API_TOKEN)
    if (explicit !== null) return explicit
    // 既定では必須化しない。必要な環境のみ REQUIRE_API_TOKEN=1 で有効化する。
    return false
}

export function shouldRequireRateLimitKV(env: SecurityEnv): boolean {
    const explicit = parseBooleanFlag(env.REQUIRE_RATE_LIMIT_KV)
    if (explicit !== null) return explicit
    return isProductionEnv(env)
}

export function shouldUseStrictCors(env: SecurityEnv): boolean {
    const explicit = parseBooleanFlag(env.STRICT_CORS)
    if (explicit !== null) return explicit
    return isProductionEnv(env)
}

export function shouldAllowDevOriginWildcards(env: SecurityEnv): boolean {
    const explicit = parseBooleanFlag(env.ALLOW_DEV_ORIGIN_WILDCARDS)
    if (explicit !== null) return explicit
    // デフォルトは fail-closed。必要時のみ明示的に許可する。
    return false
}
