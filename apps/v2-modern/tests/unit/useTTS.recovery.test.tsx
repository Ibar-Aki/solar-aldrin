import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTTS } from '@/hooks/useTTS'
import { useTTSStore } from '@/stores/useTTSStore'

interface MockSpeechSynthesis {
    speaking: boolean
    pending: boolean
    cancel: () => void
    speak: (_utterance: SpeechSynthesisUtterance) => void
    getVoices: () => SpeechSynthesisVoice[]
    addEventListener: (type: 'voiceschanged', listener: () => void) => void
    removeEventListener: (type: 'voiceschanged', listener: () => void) => void
    emitVoicesChanged: () => void
}

class MockSpeechSynthesisUtterance {
    text: string
    lang = 'ja-JP'
    rate = 1
    pitch = 1
    volume = 1
    voice: SpeechSynthesisVoice | null = null
    onstart: (() => void) | null = null
    onend: (() => void) | null = null
    onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null

    constructor(text: string) {
        this.text = text
    }
}

describe('useTTS recovery guard', () => {
    let mockSynth: MockSpeechSynthesis
    let voices: SpeechSynthesisVoice[]

    beforeEach(() => {
        vi.useFakeTimers()
        ;(globalThis as unknown as { SpeechSynthesisUtterance: typeof MockSpeechSynthesisUtterance }).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance
        voices = []
        const voicesChangedListeners = new Set<() => void>()
        mockSynth = {
            speaking: false,
            pending: false,
            cancel: vi.fn(),
            speak: vi.fn(),
            getVoices: () => voices,
            addEventListener: (_type, listener) => {
                voicesChangedListeners.add(listener)
            },
            removeEventListener: (_type, listener) => {
                voicesChangedListeners.delete(listener)
            },
            emitVoicesChanged: () => {
                voicesChangedListeners.forEach((listener) => listener())
            },
        }
        ;(window as unknown as { speechSynthesis: MockSpeechSynthesis }).speechSynthesis = mockSynth
        useTTSStore.setState({ isSpeaking: false, currentMessageId: null })
    })

    afterEach(() => {
        vi.useRealTimers()
        act(() => {
            useTTSStore.setState({ isSpeaking: false, currentMessageId: null })
        })
    })

    it('TTS状態が固着した場合に自動で stopSpeaking する', () => {
        const { unmount } = renderHook(() => useTTS({ messageId: 'test-message' }))

        act(() => {
            useTTSStore.setState({ isSpeaking: true, currentMessageId: 'test-message' })
        })
        expect(useTTSStore.getState().isSpeaking).toBe(true)

        act(() => {
            vi.advanceTimersByTime(2300)
        })

        expect(useTTSStore.getState().isSpeaking).toBe(false)
        expect(useTTSStore.getState().currentMessageId).toBeNull()
        act(() => {
            unmount()
        })
    })

    it('speechSynthesis が実際に speaking 中なら固着回復は発火しない', () => {
        mockSynth.speaking = true
        const { unmount } = renderHook(() => useTTS({ messageId: 'test-message' }))

        act(() => {
            useTTSStore.setState({ isSpeaking: true, currentMessageId: 'test-message' })
        })

        act(() => {
            vi.advanceTimersByTime(5000)
        })

        expect(useTTSStore.getState().isSpeaking).toBe(true)
        expect(useTTSStore.getState().currentMessageId).toBe('test-message')
        act(() => {
            unmount()
        })
    })

    it('not-allowed で失敗した読み上げは次のユーザー操作で1回だけ再試行する', () => {
        let speakCallCount = 0
        mockSynth.speak = vi.fn((utterance) => {
            speakCallCount += 1
            const mockUtterance = utterance as unknown as MockSpeechSynthesisUtterance
            if (speakCallCount === 1) {
                mockUtterance.onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent)
                return
            }
            mockUtterance.onstart?.()
            mockUtterance.onend?.()
        })

        const { result, unmount } = renderHook(() => useTTS({ messageId: 'test-message' }))

        act(() => {
            result.current.speak('テスト読み上げ')
        })
        expect(mockSynth.speak).toHaveBeenCalledTimes(1)

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
        })

        expect(mockSynth.speak).toHaveBeenCalledTimes(2)
        expect(useTTSStore.getState().isSpeaking).toBe(false)
        act(() => {
            unmount()
        })
    })

    it('voiceschanged 後は更新された日本語Voiceを読み上げに使用する', () => {
        const jaVoice = { lang: 'ja-JP', name: 'Google 日本語' } as SpeechSynthesisVoice
        const { result, unmount } = renderHook(() => useTTS({ messageId: 'test-message' }))

        act(() => {
            result.current.speak('初回')
        })
        const firstUtterance = (mockSynth.speak as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as MockSpeechSynthesisUtterance
        expect(firstUtterance.voice).toBeNull()

        voices = [jaVoice]
        act(() => {
            mockSynth.emitVoicesChanged()
        })

        act(() => {
            result.current.speak('2回目')
        })
        const secondUtterance = (mockSynth.speak as unknown as { mock: { calls: unknown[][] } }).mock.calls[1][0] as MockSpeechSynthesisUtterance
        expect(secondUtterance.voice).toBe(jaVoice)

        act(() => {
            unmount()
        })
    })

    it('読み上げエラー時に onTtsError コールバックへエラーコードを通知する', () => {
        const onTtsError = vi.fn()
        mockSynth.speak = vi.fn((utterance) => {
            const mockUtterance = utterance as unknown as MockSpeechSynthesisUtterance
            mockUtterance.onerror?.({ error: 'not-allowed' } as SpeechSynthesisErrorEvent)
        })
        const { result, unmount } = renderHook(() => useTTS({ messageId: 'test-message', onTtsError }))

        act(() => {
            result.current.speak('エラー通知テスト')
        })

        expect(onTtsError).toHaveBeenCalledWith('not-allowed')

        act(() => {
            unmount()
        })
    })
})
