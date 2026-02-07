import { normalizeApiBaseFromEnv } from '@/lib/apiBase'

export type TelemetryEventName =
    | 'session_start'
    | 'session_complete'
    | 'input_length'
    | 'web_vital'
    | 'chat_error'
    | 'retry_clicked'
    | 'retry_waiting'
    | 'retry_succeeded'
    | 'retry_failed'

export type TelemetryEvent = {
    event: TelemetryEventName
    sessionId?: string
    value?: number
    data?: Record<string, string | number | boolean | null | undefined>
    timestamp?: string
}

function resolveApiBase(): string {
    // 空文字は「未指定扱い」として `/api/metrics` にフォールバックさせる
    const normalized = normalizeApiBaseFromEnv(import.meta.env.VITE_API_BASE_URL, '')
    return normalized
}

const apiBase = resolveApiBase()
const token = import.meta.env.VITE_API_TOKEN
const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT || (apiBase ? `${apiBase}/metrics` : '/api/metrics')
const enabled = import.meta.env.VITE_TELEMETRY_ENABLED !== '0'
const sampleRate = Number(import.meta.env.VITE_TELEMETRY_SAMPLE_RATE || '1')

function shouldSample(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) return false
    if (rate >= 1) return true
    return Math.random() < rate
}

export async function sendTelemetry(event: TelemetryEvent) {
    if (!enabled) return
    if (!shouldSample(sampleRate)) return

    const payload: TelemetryEvent = {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
    }

    try {
        if (!token && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
            navigator.sendBeacon(endpoint, blob)
            return
        }
        await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(payload),
            keepalive: true,
        })
    } catch {
        // テレメトリ送信失敗は無視（UX優先）
    }
}
