import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChat } from '@/hooks/useChat'
import { useKYStore } from '@/stores/kyStore'
import { ApiError, postChat } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api')>()
    return {
        ...actual,
        postChat: vi.fn(),
    }
})

vi.mock('@/lib/contextUtils', () => ({
    buildContextInjection: vi.fn(async () => null),
    getWeatherContext: vi.fn(() => null),
}))

vi.mock('@/lib/observability/telemetry', () => ({
    sendTelemetry: vi.fn(async () => undefined),
}))

const initialState = useKYStore.getState()

describe('useChat retry behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')
    })

    it('タイムアウト時のみリトライを有効化し、リトライでユーザーメッセージを重複送信しない', async () => {
        const timeoutError = Object.assign(new Error('AI応答がタイムアウトしました'), {
            status: 504,
            retriable: true,
        })

        vi.mocked(postChat)
            .mockRejectedValueOnce(timeoutError)
            .mockResolvedValueOnce({
                reply: 'リトライ成功',
                extracted: {},
            })

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('足場の確認をします')
        })

        expect(result.current.canRetry).toBe(true)

        const stateAfterError = useKYStore.getState()
        expect(stateAfterError.messages.filter((m) => m.role === 'user')).toHaveLength(1)
        expect(stateAfterError.messages.at(-1)?.role).toBe('assistant')

        await act(async () => {
            await result.current.retryLastMessage()
        })

        expect(vi.mocked(postChat)).toHaveBeenCalledTimes(2)
        const retryRequest = vi.mocked(postChat).mock.calls[1][0]
        expect(retryRequest.messages.filter((m) => m.role === 'user')).toHaveLength(1)
        expect(retryRequest.messages.at(-1)?.content).toBe('足場の確認をします')

        const stateAfterRetry = useKYStore.getState()
        expect(stateAfterRetry.messages.filter((m) => m.role === 'user')).toHaveLength(1)
        expect(stateAfterRetry.messages.at(-1)?.content).toBe('リトライ成功')
    })

    it('非タイムアウトエラーではリトライを有効化しない', async () => {
        vi.mocked(postChat).mockRejectedValueOnce(new Error('Bad Request'))

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('通常エラー')
        })

        expect(result.current.canRetry).toBe(false)
    })

    it('429エラーではリトライを有効化し、待機案内を表示する', async () => {
        const rateLimitError = Object.assign(new Error('AIサービスが混雑しています'), {
            status: 429,
            retriable: true,
            retryAfterSec: 5,
        })
        vi.mocked(postChat).mockRejectedValueOnce(rateLimitError)

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('連続送信テスト')
        })

        expect(result.current.canRetry).toBe(true)
        expect(useKYStore.getState().error).toContain('5秒')
    })

    it('AI_RESPONSE_INVALID_SCHEMA は混雑文言ではなく形式エラー文言を表示する', async () => {
        vi.mocked(postChat).mockRejectedValueOnce(
            new ApiError('AIからの応答が不正な形式です。再試行してください。', {
                status: 502,
                retriable: true,
                errorType: 'server',
                code: 'AI_RESPONSE_INVALID_SCHEMA',
            })
        )

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('形式エラー検証')
        })

        expect(result.current.canRetry).toBe(true)
        const errorMessage = useKYStore.getState().error ?? ''
        expect(errorMessage).toContain('形式チェック')
        expect(errorMessage).not.toContain('混雑')
    })
})
