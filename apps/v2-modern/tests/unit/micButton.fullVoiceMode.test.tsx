import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MicButton } from '@/components/MicButton'

const startMock = vi.fn()
const stopMock = vi.fn()
const clearErrorMock = vi.fn()
const setAutoRestartMock = vi.fn()
let mockIsListening = false
let mockIsSpeaking = false

vi.mock('@/stores/useTTSStore', () => ({
    useTTSStore: (selector: (s: { isSpeaking: boolean }) => unknown) => selector({ isSpeaking: mockIsSpeaking }),
}))

vi.mock('@/hooks/useVoiceRecognition', () => ({
    useVoiceRecognition: () => ({
        isListening: mockIsListening,
        isSupported: true,
        transcript: '',
        error: null,
        start: startMock,
        stop: stopMock,
        setAutoRestart: setAutoRestartMock,
        clearError: clearErrorMock,
    }),
}))

describe('MicButton full voice mode', () => {
    afterEach(() => {
        startMock.mockClear()
        stopMock.mockClear()
        clearErrorMock.mockClear()
        setAutoRestartMock.mockClear()
        mockIsListening = false
        mockIsSpeaking = false
        cleanup()
    })

    it('完全音声会話モードでは自動開始し、自動再開を有効化する', async () => {
        render(
            <MicButton
                onTranscript={() => {}}
                voiceMode="full_voice"
                autoStart
                disabled={false}
                inputValue=""
            />
        )

        await waitFor(() => {
            expect(startMock).toHaveBeenCalledTimes(1)
        })
        expect(setAutoRestartMock).toHaveBeenCalledWith(true)
    })

    it('通常モードでは自動再開を無効化し、自動開始しない', () => {
        render(
            <MicButton
                onTranscript={() => {}}
                voiceMode="normal"
                disabled={false}
                inputValue=""
            />
        )

        expect(startMock).not.toHaveBeenCalled()
        expect(setAutoRestartMock).toHaveBeenCalledWith(false)
    })

    it('自動開始ゲートが無効なら、完全音声会話モードでも自動開始しない', () => {
        render(
            <MicButton
                onTranscript={() => {}}
                voiceMode="full_voice"
                autoStart
                autoStartEnabled={false}
                disabled={false}
                inputValue=""
            />
        )

        expect(startMock).not.toHaveBeenCalled()
    })

    it('強制停止解除と自動開始が同時条件でも start は1回のみ', async () => {
        const noop = () => {}

        mockIsListening = true
        mockIsSpeaking = true
        const { rerender } = render(
            <MicButton
                onTranscript={noop}
                voiceMode="full_voice"
                autoStart
                disabled={false}
                inputValue=""
            />
        )

        await waitFor(() => {
            expect(stopMock).toHaveBeenCalledTimes(1)
        })
        expect(startMock).toHaveBeenCalledTimes(0)

        mockIsListening = false
        mockIsSpeaking = false
        rerender(
            <MicButton
                onTranscript={noop}
                voiceMode="full_voice"
                autoStart
                disabled={false}
                inputValue=""
            />
        )

        await waitFor(() => {
            expect(startMock).toHaveBeenCalledTimes(1)
        })
    })

    it('完全音声会話モードで手動開始した場合、autoRestart を再有効化して開始する', () => {
        const noop = () => {}
        const { getByRole } = render(
            <MicButton
                onTranscript={noop}
                voiceMode="full_voice"
                autoStart={false}
                disabled={false}
                inputValue=""
            />
        )

        setAutoRestartMock.mockClear()
        startMock.mockClear()

        fireEvent.click(getByRole('button', { name: '音声認識を開始' }))

        expect(setAutoRestartMock).toHaveBeenCalledWith(true)
        expect(startMock).toHaveBeenCalledTimes(1)
    })
})
