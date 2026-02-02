import * as Sentry from '@sentry/react'

let initialized = false

export function initSentry() {
    if (initialized) return
    const dsn = import.meta.env.VITE_SENTRY_DSN
    if (!dsn) return

    const environment = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE
    const release = import.meta.env.VITE_SENTRY_RELEASE
    const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0')
    const sampleRate = Number(import.meta.env.VITE_SENTRY_SAMPLE_RATE || '1')

    Sentry.init({
        dsn,
        environment,
        release,
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
        sampleRate: Number.isFinite(sampleRate) ? sampleRate : 1,
    })

    initialized = true
}
