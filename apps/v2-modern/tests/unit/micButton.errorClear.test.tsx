import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MicButton } from '@/components/MicButton'

const clearErrorMock = vi.fn()

vi.mock('@/stores/useTTSStore', () => ({
    useTTSStore: (selector: (s: { isSpeaking: boolean }) => unknown) => selector({ isSpeaking: false }),
}))

vi.mock('@/hooks/useVoiceRecognition', () => ({
    useVoiceRecognition: () => ({
        isListening: false,
        isSupported: true,
        transcript: '',
        error: '音声認識エラー: test',
        start: vi.fn(),
        stop: vi.fn(),
        setAutoRestart: vi.fn(),
        clearError: clearErrorMock,
    }),
}))

describe('MicButton error UX', () => {
    afterEach(() => {
        clearErrorMock.mockClear()
        cleanup()
    })

    it('入力欄に1文字入ったら音声エラー表示をクリアする', async () => {
        const noop = () => {}

        const { rerender } = render(
            <MicButton onTranscript={noop} disabled={false} inputValue="" />
        )

        expect(clearErrorMock).not.toHaveBeenCalled()

        rerender(<MicButton onTranscript={noop} disabled={false} inputValue="a" />)

        await waitFor(() => {
            expect(clearErrorMock).toHaveBeenCalledTimes(1)
        })
    })
})

