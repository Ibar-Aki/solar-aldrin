import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, postFeedback } from '@/lib/api'
import type { FeedbackRequest } from '@/lib/schema'

const baseRequest: FeedbackRequest = {
    sessionId: 'test-session-12345678',
    clientId: 'test-client-12345678',
    context: {
        work: '足場組立',
        location: '現場A',
        weather: '晴れ',
    },
    extracted: {
        risks: ['落下'],
        measures: ['安全帯着用'],
        actionGoal: '足元確認ヨシ',
    },
}

describe('postFeedback error classification', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('ネットワーク失敗を network として分類する', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network down')))

        try {
            await postFeedback(baseRequest)
            throw new Error('expected postFeedback to throw')
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError)
            expect(error).toMatchObject({
                errorType: 'network',
                retriable: false,
            })
        }
    })

    it('AbortErrorはそのまま再スローする', async () => {
        const abortError = new Error('Aborted')
        abortError.name = 'AbortError'
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(abortError))

        await expect(postFeedback(baseRequest)).rejects.toMatchObject({
            name: 'AbortError',
        })
    })

    it('429エラーを rate_limit として分類し Retry-After を保持する', async () => {
        const res = new Response(
            JSON.stringify({
                error: { message: 'AIサービスが混雑しています' },
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': '15',
                },
            }
        )

        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res))

        await expect(postFeedback(baseRequest)).rejects.toMatchObject({
            errorType: 'rate_limit',
            status: 429,
            retriable: true,
            retryAfterSec: 15,
        })
    })

    it('5xxエラーを server として分類し retriable を true にする', async () => {
        const res = new Response(
            JSON.stringify({
                error: { message: 'サーバーエラー' },
            }),
            {
                status: 503,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        )

        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res))

        await expect(postFeedback(baseRequest)).rejects.toMatchObject({
            errorType: 'server',
            status: 503,
            retriable: true,
        })
    })

    it('204レスポンスは null を返す', async () => {
        const res = new Response(null, { status: 204 })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res))

        const result = await postFeedback(baseRequest)
        expect(result).toBeNull()
    })
})
