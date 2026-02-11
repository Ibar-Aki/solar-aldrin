import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, postChat } from '@/lib/api'
import type { ChatRequest } from '@/lib/schema'

const baseRequest: ChatRequest = {
    messages: [{ role: 'user', content: '足場の確認をします' }],
}

describe('postChat error classification', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('ネットワーク失敗を network として分類する', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network down')))

        try {
            await postChat(baseRequest)
            throw new Error('expected postChat to throw')
        } catch (error) {
            expect(error).toBeInstanceOf(ApiError)
            expect(error).toMatchObject({
                errorType: 'network',
                retriable: false,
            })
        }
    })

    it('429エラーを rate_limit として分類し Retry-After を保持する', async () => {
        const res = new Response(
            JSON.stringify({
                error: 'AIサービスが混雑しています',
                code: 'AI_UPSTREAM_ERROR',
                retriable: true,
            }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': '12',
                },
            }
        )

        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(res))

        await expect(postChat(baseRequest)).rejects.toMatchObject({
            errorType: 'rate_limit',
            status: 429,
            code: 'AI_UPSTREAM_ERROR',
            retriable: true,
            retryAfterSec: 12,
        })
    })
})
