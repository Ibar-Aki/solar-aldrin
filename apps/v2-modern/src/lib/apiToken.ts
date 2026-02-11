const STORAGE_KEY = 'voice-ky-v2.api_token'

export function getApiToken(): string | null {
    if (typeof window === 'undefined') return null
    try {
        const value = window.localStorage.getItem(STORAGE_KEY)
        const trimmed = typeof value === 'string' ? value.trim() : ''
        return trimmed.length > 0 ? trimmed : null
    } catch {
        return null
    }
}

export function setApiToken(token: string): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(STORAGE_KEY, token.trim())
    } catch {
        // ignore
    }
}

export function clearApiToken(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(STORAGE_KEY)
    } catch {
        // ignore
    }
}

export function hasApiToken(): boolean {
    return Boolean(getApiToken())
}

export function maskApiToken(token: string | null | undefined): string {
    const value = typeof token === 'string' ? token.trim() : ''
    if (!value) return ''
    if (value.length <= 8) return `${value.slice(0, 2)}...`
    return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export const API_TOKEN_STORAGE_KEY = STORAGE_KEY

