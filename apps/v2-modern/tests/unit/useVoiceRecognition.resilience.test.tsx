import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

type StartPlan = 'start' | 'throw'

class MockSpeechRecognition {
    static instances: MockSpeechRecognition[] = []
    static startPlans: StartPlan[] = []
    static pendingEnds: Array<() => void> = []

    lang = 'ja-JP'
    continuous = true
    interimResults = true

    onstart: (() => void) | null = null
    onresult: ((event: SpeechRecognitionEvent) => void) | null = null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null
    onend: (() => void) | null = null

    constructor() {
        MockSpeechRecognition.instances.push(this)
    }

    static reset() {
        MockSpeechRecognition.instances = []
        MockSpeechRecognition.startPlans = []
        MockSpeechRecognition.pendingEnds = []
    }

    static flushPendingEnds() {
        const queue = [...MockSpeechRecognition.pendingEnds]
        MockSpeechRecognition.pendingEnds = []
        queue.forEach((emitEnd) => emitEnd())
    }

    start() {
        const plan = MockSpeechRecognition.startPlans.shift() ?? 'start'
        if (plan === 'throw') {
            throw new Error('mock start failure')
        }
        this.onstart?.()
    }

    stop() {
        MockSpeechRecognition.pendingEnds.push(() => {
            this.onend?.()
        })
    }

    emitResult(text: string, isFinal: boolean) {
        const event = {
            resultIndex: 0,
            results: [
                {
                    0: { transcript: text },
                    isFinal,
                },
            ],
        } as unknown as SpeechRecognitionEvent
        this.onresult?.(event)
    }
}

function installMockRecognition() {
    ;(window as any).SpeechRecognition = MockSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    ;(window as any).webkitSpeechRecognition = undefined // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('useVoiceRecognition resilience', () => {
    beforeEach(() => {
        vi.resetModules()
        MockSpeechRecognition.reset()
        installMockRecognition()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete (window as any).SpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
        delete (window as any).webkitSpeechRecognition // eslint-disable-line @typescript-eslint/no-explicit-any
    })

    it('初回 start 失敗後も autoRestart で再試行して復帰する', async () => {
        MockSpeechRecognition.startPlans = ['throw', 'start']
        const { useVoiceRecognition } = await import('@/hooks/useVoiceRecognition')
        const onErrorMock = vi.fn()
        const { result } = renderHook(() => useVoiceRecognition({ autoRestart: true, onError: onErrorMock }))

        act(() => {
            result.current.start()
        })

        await waitFor(() => {
            expect(onErrorMock).toHaveBeenCalledWith('音声認識の開始に失敗しました')
        })

        await waitFor(() => {
            expect(result.current.isListening).toBe(true)
        }, { timeout: 2000 })
        await waitFor(() => {
            expect(result.current.error).toBeNull()
        })
        expect(MockSpeechRecognition.instances.length).toBeGreaterThanOrEqual(2)
    })

    it('旧インスタンスの onend が遅延発火しても、現行インスタンスを停止しない', async () => {
        MockSpeechRecognition.startPlans = ['start', 'start']
        const { useVoiceRecognition } = await import('@/hooks/useVoiceRecognition')
        const { result } = renderHook(() => useVoiceRecognition({ autoRestart: false }))

        act(() => {
            result.current.start()
        })
        await waitFor(() => {
            expect(result.current.isListening).toBe(true)
        })

        act(() => {
            result.current.stop()
        })
        await waitFor(() => {
            expect(result.current.isListening).toBe(false)
        })

        act(() => {
            result.current.start()
        })
        await waitFor(() => {
            expect(result.current.isListening).toBe(true)
        })

        const secondRecognition = MockSpeechRecognition.instances[1]
        expect(secondRecognition).toBeDefined()

        act(() => {
            MockSpeechRecognition.flushPendingEnds()
        })

        expect(result.current.isListening).toBe(true)

        act(() => {
            secondRecognition?.emitResult('テスト入力', false)
        })
        await waitFor(() => {
            expect(result.current.transcript).toBe('テスト入力')
        })
    })
})
