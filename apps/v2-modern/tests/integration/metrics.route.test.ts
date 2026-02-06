import { describe, expect, it } from 'vitest'
import { metrics } from '../../workers/routes/metrics'

const VALID_EVENTS = [
    'session_start',
    'session_complete',
    'input_length',
    'web_vital',
    'chat_error',
    'retry_clicked',
    'retry_succeeded',
    'retry_failed',
] as const

describe('Metrics Route', () => {
    it('許可されたイベントを受理する', async () => {
        for (const event of VALID_EVENTS) {
            const req = new Request('http://localhost/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    sessionId: '11111111-1111-4111-8111-111111111111',
                    value: 1,
                    data: { source: 'test' },
                }),
            })

            const res = await metrics.fetch(req, {})
            expect(res.status).toBe(200)
        }
    })

    it('未定義イベントを拒否する', async () => {
        const req = new Request('http://localhost/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'invalid_event',
                sessionId: '11111111-1111-4111-8111-111111111111',
            }),
        })

        const res = await metrics.fetch(req, {})
        expect(res.status).toBe(400)
    })
})
