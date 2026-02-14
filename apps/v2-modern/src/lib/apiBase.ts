/**
 * APIベースURLの正規化
 *
 * 想定:
 * - 未指定の場合は `/api`（Vite proxy 前提）
 * - 絶対URL（http/https）の場合、末尾に `/api` が無ければ補完する
 *   - 例: `http://localhost:8787` -> `http://localhost:8787/api`
 * - 相対パスは原則そのまま（例: `/api`, `/backend/api`）
 */

function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value)
}

function trimTrailingSlashes(value: string): string {
    return value.replace(/\/+$/g, '')
}

function parseUrlOrNull(value: string): URL | null {
    try {
        return new URL(value)
    } catch {
        return null
    }
}

function isLoopbackHostname(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase()
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]'
}

export function normalizeApiBaseFromEnv(envBase: unknown, fallbackBase: string = '/api'): string {
    if (typeof envBase !== 'string') return fallbackBase

    const trimmed = envBase.trim()
    if (!trimmed) return fallbackBase

    const noSlash = trimTrailingSlashes(trimmed)

    // 絶対URLは `/api` への誘導を強くする（ミス設定が最も起きやすい）
    if (isHttpUrl(noSlash)) {
        return noSlash.endsWith('/api') ? noSlash : `${noSlash}/api`
    }

    // 相対パスはそのまま（既に `/api` を含む構成もあり得るため）
    return noSlash
}

type ResolveRuntimeApiBaseOptions = {
    envBase: unknown
    fallbackBase?: string
    runtimeOrigin?: string
    productionApiBase?: unknown
}

export function resolveRuntimeApiBase(options: ResolveRuntimeApiBaseOptions): string {
    const fallbackBase = options.fallbackBase ?? '/api'
    const normalizedBase = normalizeApiBaseFromEnv(options.envBase, fallbackBase)
    if (!isHttpUrl(normalizedBase)) return normalizedBase

    const runtimeOrigin = typeof options.runtimeOrigin === 'string'
        ? options.runtimeOrigin.trim()
        : ''
    if (!runtimeOrigin) return normalizedBase

    const runtimeUrl = parseUrlOrNull(runtimeOrigin)
    const apiUrl = parseUrlOrNull(normalizedBase)
    if (!runtimeUrl || !apiUrl) return normalizedBase

    // HTTPS配信中に localhost API が指定されている場合は、混在コンテンツで失敗するため補正する。
    if (
        runtimeUrl.protocol === 'https:' &&
        !isLoopbackHostname(runtimeUrl.hostname) &&
        isLoopbackHostname(apiUrl.hostname)
    ) {
        const productionApiBase = normalizeApiBaseFromEnv(
            options.productionApiBase,
            'https://voice-ky-v2.solar-aldrin-ky.workers.dev/api'
        )
        return productionApiBase
    }

    return normalizedBase
}
