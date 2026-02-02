export type LogLevel = 'info' | 'warn' | 'error'

export type LogContext = Record<string, string | number | boolean | null | undefined>

const service = 'workers'

function emit(level: LogLevel, message: string, context: LogContext = {}) {
    const payload = {
        timestamp: new Date().toISOString(),
        level,
        service,
        message,
        ...context,
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
