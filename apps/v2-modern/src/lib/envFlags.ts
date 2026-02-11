const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

export function parseBooleanFlag(raw: string | null | undefined): boolean | null {
    if (raw === undefined || raw === null) return null
    const normalized = raw.trim().toLowerCase()
    if (TRUE_VALUES.has(normalized)) return true
    if (FALSE_VALUES.has(normalized)) return false
    return null
}

export function resolveBooleanFlag(raw: string | null | undefined, defaultValue: boolean): boolean {
    const parsed = parseBooleanFlag(raw)
    return parsed ?? defaultValue
}

export function shouldRequireApiTokenClient(): boolean {
    return resolveBooleanFlag(import.meta.env.VITE_REQUIRE_API_TOKEN, false)
}

export function shouldEnableSilentRetryClient(): boolean {
    return resolveBooleanFlag(import.meta.env.VITE_ENABLE_RETRY_SILENT, false)
}
