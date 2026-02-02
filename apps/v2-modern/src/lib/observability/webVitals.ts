import { onCLS, onINP, onLCP, type Metric } from 'web-vitals'
import { sendTelemetry } from './telemetry'

const sampleRate = Number(import.meta.env.VITE_WEB_VITALS_SAMPLE_RATE || '0.1')
let started = false

function shouldSample(rate: number) {
    if (!Number.isFinite(rate) || rate <= 0) return false
    if (rate >= 1) return true
    return Math.random() < rate
}

function report(metric: Metric) {
    sendTelemetry({
        event: 'web_vital',
        value: metric.value,
        data: {
            name: metric.name,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
            navigationType: metric.navigationType,
            path: window.location.pathname,
        },
    })
}

export function startWebVitals() {
    if (started) return
    if (!shouldSample(sampleRate)) return

    started = true
    onCLS(report)
    onINP(report)
    onLCP(report)
}
