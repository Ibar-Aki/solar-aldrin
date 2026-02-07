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

