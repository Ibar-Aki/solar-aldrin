import * as Sentry from '@sentry/react'

let initialized = false

type SentryTestWindow = Window & {
    __sentryTestCaptureException?: (message: string, tags?: Record<string, string>) => string
    __sentryTestRunTraceProbe?: (params: {
        apiBaseUrl: string
        path?: string
        workMs?: number
        testId?: string
    }) => Promise<{
        status: number
        sentryTraceSent: string
        sentryTraceReceived: string | null
        baggageSent: string | null
        baggageReceived: string | null
        body: unknown
    }>
}

function parseTracePropagationTargets(raw: string | undefined): Array<string | RegExp> {
    if (!raw?.trim()) {
        // Same-origin API and the deployed worker origin are both included by default.
        return [/^\/api\//, 'https://voice-ky-v2.solar-aldrin-ky.workers.dev']
    }
    return raw
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .map((value) => {
            if (value.startsWith('/') && value.endsWith('/') && value.length > 2) {
                try {
                    return new RegExp(value.slice(1, -1))
                } catch {
                    return value
                }
            }
            return value
        })
}

function isTruthyEnv(raw: string | undefined): boolean {
    const normalized = raw?.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function registerSentryTestHooks() {
    const testWindow = window as SentryTestWindow

    testWindow.__sentryTestCaptureException = (message, tags = {}) => {
        return Sentry.withScope((scope) => {
            scope.setTag('sentry_test', 'true')
            for (const [key, value] of Object.entries(tags)) {
                scope.setTag(key, value)
            }
            return Sentry.captureException(new Error(message))
        })
    }

    testWindow.__sentryTestRunTraceProbe = async ({ apiBaseUrl, path = '/api/debug/sentry-test-trace', workMs = 120, testId = 'unset' }) => {
        const endpoint = new URL(path, apiBaseUrl)
        endpoint.searchParams.set('testId', testId)
        endpoint.searchParams.set('workMs', String(workMs))

        return Sentry.startSpan(
            { name: 'sentry.test.frontend_trace_probe', op: 'test.trace.frontend' },
            async (span) => {
                const sentryTrace = Sentry.spanToTraceHeader(span)
                const traceData = Sentry.getTraceData()
                const baggage = traceData.baggage ?? null

                const headers = new Headers()
                headers.set('sentry-trace', sentryTrace)
                if (baggage) headers.set('baggage', baggage)

                const response = await fetch(endpoint.toString(), {
                    method: 'GET',
                    headers,
                    credentials: 'include',
                })
                const body = await response.json().catch(() => null)

                return {
                    status: response.status,
                    sentryTraceSent: sentryTrace,
                    sentryTraceReceived: response.headers.get('x-sentry-trace'),
                    baggageSent: baggage,
                    baggageReceived: response.headers.get('x-sentry-baggage'),
                    body,
                }
            },
        )
    }
}

export function initSentry() {
    if (initialized) return
    const dsn = import.meta.env.VITE_SENTRY_DSN
    if (!dsn) return

    const environment = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE
    const release = import.meta.env.VITE_SENTRY_RELEASE
    const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0')
    const sampleRate = Number(import.meta.env.VITE_SENTRY_SAMPLE_RATE || '1')
    const tracePropagationTargets = parseTracePropagationTargets(import.meta.env.VITE_SENTRY_TRACE_PROPAGATION_TARGETS)

    Sentry.init({
        dsn,
        environment,
        release,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
        sampleRate: Number.isFinite(sampleRate) ? sampleRate : 1,
        tracePropagationTargets,
    })

    if (isTruthyEnv(import.meta.env.VITE_ENABLE_SENTRY_TEST_HOOK)) {
        registerSentryTestHooks()
    }

    initialized = true
}
