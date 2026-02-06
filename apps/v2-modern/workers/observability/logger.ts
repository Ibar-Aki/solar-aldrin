export type LogLevel = 'info' | 'warn' | 'error'

export type LogContext = Record<string, string | number | boolean | null | undefined>

const service = 'workers'
const SECRET_KEY_PATTERNS = [
    /authorization/i,
    /api[_-]?key/i,
    /secret/i,
    /password/i,
    /^token$/i,
    /cookie/i,
]
const PII_KEY_PATTERNS = [
    /user(name)?/i,
    /site(name)?/i,
    /email/i,
    /phone/i,
    /tel/i,
    /address/i,
]
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_PATTERN = /\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g
const LONG_NUMBER_PATTERN = /\b\d{7,}\b/g
const OPENAI_KEY_PATTERN = /sk-[A-Za-z0-9_-]{10,}/g
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi
const SAFE_LOG_KEYS = new Set(['tokenFingerprint', 'token_fingerprint'])

function shouldFullyRedactKey(key: string): boolean {
    if (SAFE_LOG_KEYS.has(key)) return false
    return SECRET_KEY_PATTERNS.some(pattern => pattern.test(key)) || PII_KEY_PATTERNS.some(pattern => pattern.test(key))
}

function sanitizeStringValue(value: string): string {
    return value
        .replace(EMAIL_PATTERN, '[email]')
        .replace(PHONE_PATTERN, '[phone]')
        .replace(LONG_NUMBER_PATTERN, '[number]')
        .replace(OPENAI_KEY_PATTERN, '[secret]')
        .replace(BEARER_PATTERN, 'Bearer [redacted]')
}

export function sanitizeLogContext(context: LogContext = {}): LogContext {
    const sanitized: LogContext = {}

    for (const [key, value] of Object.entries(context)) {
        if (value === undefined || value === null) {
            sanitized[key] = value
            continue
        }

        if (shouldFullyRedactKey(key)) {
            sanitized[key] = '[redacted]'
            continue
        }

        if (typeof value === 'string') {
            sanitized[key] = sanitizeStringValue(value)
            continue
        }

        sanitized[key] = value
    }

    return sanitized
}

function emit(level: LogLevel, message: string, context: LogContext = {}) {
    const sanitizedContext = sanitizeLogContext(context)
    const payload = {
        timestamp: new Date().toISOString(),
        level,
        service,
        message,
        ...sanitizedContext,
    }

    const line = JSON.stringify(payload)

    if (level === 'error') {
        console.error(line)
        return
    }
    if (level === 'warn') {
        console.warn(line)
        return
    }
    console.log(line)
}

export function logInfo(message: string, context?: LogContext) {
    emit('info', message, context)
}

export function logWarn(message: string, context?: LogContext) {
    emit('warn', message, context)
}

export function logError(message: string, context?: LogContext) {
    emit('error', message, context)
}
