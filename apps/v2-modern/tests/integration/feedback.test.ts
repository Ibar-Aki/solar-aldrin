import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { feedback } from '../../workers/routes/feedback'

type FeedbackEnv = {
    OPENAI_API_KEY: string
    FEEDBACK_KV?: {
        get: (key: string) => Promise<string | null>
        put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
    }
}

function createRequest(payload: unknown): Request {
    return new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
}

function createPayload(sessionId: string, clientId: string) {
    return {
        sessionId,
        clientId,
        context: {
            work: '足場組立',
            location: 'A工区',
        },
        extracted: {
            risks: ['転落'],
            measures: ['安全帯の確認'],
            actionGoal: '声かけヨシ',
        },
        chatDigest: '朝礼で危険予知済み',
    }
}

function mockFeedbackResponse() {
    return {
        choices: [{
            message: {
                content: JSON.stringify({
                    praise: 'よくできています。',
                    tip: '次回は指差呼称も加えるとさらに良いです。',
                    supplements: [{ risk: '荷崩れ', measure: '荷締め確認' }],
                    polishedGoal: { original: '声かけヨシ', polished: '一呼吸おいて声かけヨシ！' },
                }),
            },
            finish_reason: 'stop',
        }],
        usage: { total_tokens: 80 },
    }
}

describe('Feedback API Integration', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.useRealTimers()
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockFeedbackResponse(),
            text: async () => '',
        } as Response)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('正常系で200とフィードバック本文を返す', async () => {
        const req = createRequest(createPayload('session-0001', 'client-0001'))
        const env: FeedbackEnv = { OPENAI_API_KEY: 'mock-key' }

        const res = await feedback.fetch(req, env)
        expect(res.status).toBe(200)

        const body = await res.json() as {
            praise: string
            tip: string
            supplements: Array<{ risk: string; measure: string }>
            meta?: { cached?: boolean }
        }

        expect(body.praise).toBe('よくできています。')
        expect(body.tip).toContain('指差呼称')
        expect(body.supplements.length).toBe(1)
        expect(body.meta?.cached).not.toBe(true)
        expect(vi.mocked(fetch).mock.calls.length).toBe(1)
    })

    it('同一セッション・同一クライアントの2回目はキャッシュヒットする', async () => {
        const payload = createPayload('session-cache-0002', 'client-cache-0002')
        const env: FeedbackEnv = { OPENAI_API_KEY: 'mock-key' }

        const first = await feedback.fetch(createRequest(payload), env)
        expect(first.status).toBe(200)
        expect(vi.mocked(fetch).mock.calls.length).toBe(1)

        const second = await feedback.fetch(createRequest(payload), env)
        expect(second.status).toBe(200)
        const secondBody = await second.json() as { meta?: { cached?: boolean } }
        expect(secondBody.meta?.cached).toBe(true)
        expect(vi.mocked(fetch).mock.calls.length).toBe(1)
    })

    it('キャッシュTTLを過ぎると再取得する', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-02-14T00:00:00.000Z'))

        const payload = createPayload('session-ttl-0003', 'client-ttl-0003')
        const env: FeedbackEnv = { OPENAI_API_KEY: 'mock-key' }

        const first = await feedback.fetch(createRequest(payload), env)
        expect(first.status).toBe(200)
        expect(vi.mocked(fetch).mock.calls.length).toBe(1)

        vi.setSystemTime(new Date('2026-02-14T00:05:01.000Z'))
        const second = await feedback.fetch(createRequest(payload), env)
        expect(second.status).toBe(200)
        expect(vi.mocked(fetch).mock.calls.length).toBe(2)
    })
})
