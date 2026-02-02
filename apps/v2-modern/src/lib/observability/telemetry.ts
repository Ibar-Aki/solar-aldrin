export type TelemetryEventName =
    | 'session_start'
    | 'session_complete'
    | 'input_length'
    | 'web_vital'

export type TelemetryEvent = {
    event: TelemetryEventName
    sessionId?: string
    value?: number
    data?: Record<string, string | number | boolean | null | undefined>
    timestamp?: string
}

const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT || '/api/metrics'
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
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
            navigator.sendBeacon(endpoint, blob)
            return
        }
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        })
    } catch {
        // テレメトリ送信失敗は無視（UX優先）
    }
}
