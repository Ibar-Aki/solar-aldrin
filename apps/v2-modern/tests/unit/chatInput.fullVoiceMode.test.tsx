import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatInput } from '@/components/ChatInput'

vi.mock('@/components/MicButton', () => ({
    MicButton: ({
        onTranscript,
        onFinalTranscript,
    }: {
        onTranscript: (text: string) => void
        onFinalTranscript?: (text: string) => void
    }) => (
        <button
            type="button"
            data-testid="mock-mic"
            onClick={() => {
                onTranscript('足元が滑ります')
                onFinalTranscript?.('足元が滑ります')
            }}
        >
            Mic
        </button>
    ),
}))

describe('ChatInput full voice mode', () => {
    it('完全音声会話モードでは最終認識結果を自動送信する', () => {
        const onSend = vi.fn()
        render(<ChatInput onSend={onSend} variant="bare" voiceMode="full_voice" />)

        fireEvent.click(screen.getByTestId('mock-mic'))

        expect(onSend).toHaveBeenCalledTimes(1)
        expect(onSend).toHaveBeenCalledWith('足元が滑ります')
    })

    it('同一文言の連続確定は短時間で重複送信しない', () => {
        const onSend = vi.fn()
        render(<ChatInput onSend={onSend} variant="bare" voiceMode="full_voice" />)

        fireEvent.click(screen.getByTestId('mock-mic'))
        fireEvent.click(screen.getByTestId('mock-mic'))

        expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('通常モードでは最終認識結果を自動送信しない', () => {
        const onSend = vi.fn()
        render(<ChatInput onSend={onSend} variant="bare" voiceMode="normal" />)

        fireEvent.click(screen.getByTestId('mock-mic'))

        expect(onSend).not.toHaveBeenCalled()
        expect(screen.getByDisplayValue('足元が滑ります')).toBeInTheDocument()
    })
})

