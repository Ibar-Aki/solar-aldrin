import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { MicButton } from '@/components/MicButton'

let capturedOnResult: ((transcript: string, isFinal: boolean) => void) | undefined

vi.mock('@/stores/useTTSStore', () => ({
    useTTSStore: (selector: (s: { isSpeaking: boolean }) => unknown) => selector({ isSpeaking: false }),
}))

vi.mock('@/hooks/useVoiceRecognition', () => ({
    useVoiceRecognition: (options?: { onResult?: (transcript: string, isFinal: boolean) => void }) => {
        capturedOnResult = options?.onResult
        return {
            isListening: false,
            isSupported: true,
            transcript: '',
            error: null,
            start: vi.fn(),
            stop: vi.fn(),
            setAutoRestart: vi.fn(),
            clearError: vi.fn(),
        }
    },
}))

describe('MicButton transcript flow', () => {
    beforeEach(() => {
        capturedOnResult = undefined
    })

    it('完全音声会話モードでは中間結果も入力欄へ反映する', () => {
        const onTranscript = vi.fn()
        const onFinalTranscript = vi.fn()

        render(
            <MicButton
                onTranscript={onTranscript}
                onFinalTranscript={onFinalTranscript}
                voiceMode="full_voice"
                disabled={false}
                inputValue=""
            />
        )

        act(() => {
            capturedOnResult?.('足元が', false)
        })
        expect(onTranscript).toHaveBeenNthCalledWith(1, '足元が')
        expect(onFinalTranscript).not.toHaveBeenCalled()

        act(() => {
            capturedOnResult?.('足元が滑ります', true)
        })
        expect(onTranscript).toHaveBeenNthCalledWith(2, '足元が滑ります')
        expect(onFinalTranscript).toHaveBeenCalledTimes(1)
        expect(onFinalTranscript).toHaveBeenCalledWith('足元が滑ります')
    })

    it('通常モードでは確定結果のみ反映する', () => {
        const onTranscript = vi.fn()
        const onFinalTranscript = vi.fn()

        render(
            <MicButton
                onTranscript={onTranscript}
                onFinalTranscript={onFinalTranscript}
                voiceMode="normal"
                disabled={false}
                inputValue=""
            />
        )

        act(() => {
            capturedOnResult?.('足元が', false)
        })
        expect(onTranscript).not.toHaveBeenCalled()
        expect(onFinalTranscript).not.toHaveBeenCalled()

        act(() => {
            capturedOnResult?.('足元が滑ります', true)
        })
        expect(onTranscript).toHaveBeenCalledTimes(1)
        expect(onTranscript).toHaveBeenCalledWith('足元が滑ります')
        expect(onFinalTranscript).toHaveBeenCalledTimes(1)
        expect(onFinalTranscript).toHaveBeenCalledWith('足元が滑ります')
    })
})
