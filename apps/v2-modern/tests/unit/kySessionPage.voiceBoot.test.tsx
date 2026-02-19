import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { KYSessionPage } from '@/pages/KYSessionPage'
import { useKYStore } from '@/stores/kyStore'
import { useVoiceConversationModeStore } from '@/stores/useVoiceConversationModeStore'

const navigateMock = vi.fn()
const sendMessageMock = vi.fn()
const completeFirstWorkItemMock = vi.fn()
const completeSecondWorkItemMock = vi.fn()
const applyRiskLevelSelectionMock = vi.fn()
const completeSafetyConfirmationMock = vi.fn()
const initializeChatMock = vi.fn()
const retryLastMessageMock = vi.fn()
const speakMock = vi.fn()

let locationState: unknown = null
let mockIsSpeaking = false

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useLocation: () => ({ state: locationState }),
    }
})

vi.mock('@/hooks/useChat', () => ({
    useChat: () => ({
        sendMessage: sendMessageMock,
        completeFirstWorkItem: completeFirstWorkItemMock,
        completeSecondWorkItem: completeSecondWorkItemMock,
        applyRiskLevelSelection: applyRiskLevelSelectionMock,
        completeSafetyConfirmation: completeSafetyConfirmationMock,
        initializeChat: initializeChatMock,
        retryLastMessage: retryLastMessageMock,
        canRetry: false,
    }),
}))

vi.mock('@/hooks/useTTS', () => ({
    useTTS: () => ({
        speak: speakMock,
        cancel: vi.fn(),
        isSpeaking: false,
        isAnySpeaking: mockIsSpeaking,
        isSupported: true,
    }),
}))

vi.mock('@/stores/useTTSStore', () => ({
    useTTSStore: (selector: (state: { isSpeaking: boolean }) => unknown) => selector({ isSpeaking: mockIsSpeaking }),
}))

vi.mock('@/components/ChatInput', () => ({
    ChatInput: ({ micAutoStartEnabled }: { micAutoStartEnabled?: boolean }) => (
        <div data-testid="chat-input-proxy" data-mic-autostart-enabled={String(micAutoStartEnabled)} />
    ),
}))

vi.mock('@/components/ChatBubble', () => ({
    ChatBubble: ({ autoSpeak }: { autoSpeak?: boolean }) => (
        <div data-testid="chat-bubble-proxy" data-autospeak={String(autoSpeak)} />
    ),
}))

const initialState = useKYStore.getState()

describe('KYSessionPage initial voice boot', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        sendMessageMock.mockReset()
        completeFirstWorkItemMock.mockReset()
        completeSecondWorkItemMock.mockReset()
        applyRiskLevelSelectionMock.mockReset()
        completeSafetyConfirmationMock.mockReset()
        initializeChatMock.mockReset()
        retryLastMessageMock.mockReset()
        speakMock.mockReset()
        locationState = null
        mockIsSpeaking = false
        useKYStore.setState(initialState, true)
        useVoiceConversationModeStore.setState({ mode: 'normal' })
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')
    })

    it('再開かつ完全音声会話モードでは、初回ガイド音声を再生しマイク自動開始を待機する', async () => {
        locationState = { entry: 'resume' }
        useVoiceConversationModeStore.setState({ mode: 'full_voice' })
        useKYStore.getState().addMessage('assistant', '前回の続きです。')

        render(<KYSessionPage />)

        await waitFor(() => {
            expect(speakMock).toHaveBeenCalledTimes(1)
        })
        expect(String(speakMock.mock.calls[0]?.[0])).toContain('KY活動を再開します')
        expect(screen.getByTestId('chat-input-proxy')).toHaveAttribute('data-mic-autostart-enabled', 'false')
    })

    it('開始導線情報が無い場合は、初回ガイド音声を再生しない', () => {
        useVoiceConversationModeStore.setState({ mode: 'full_voice' })
        render(<KYSessionPage />)

        expect(speakMock).not.toHaveBeenCalled()
        expect(screen.getByTestId('chat-input-proxy')).toHaveAttribute('data-mic-autostart-enabled', 'true')
    })

    it('再開かつメッセージ0件でも、初回ガイド音声を再生する', async () => {
        locationState = { entry: 'resume' }
        useVoiceConversationModeStore.setState({ mode: 'full_voice' })

        render(<KYSessionPage />)

        await waitFor(() => {
            expect(speakMock).toHaveBeenCalledTimes(1)
        })
        expect(String(speakMock.mock.calls[0]?.[0])).toContain('KY活動を再開します')
    })

    it('初期ブート待機中は、既存AIメッセージの autoSpeak を抑止する', async () => {
        locationState = { entry: 'resume' }
        useVoiceConversationModeStore.setState({ mode: 'full_voice' })
        useKYStore.getState().addMessage('assistant', '危険ポイントを教えてください。')

        render(<KYSessionPage />)

        await waitFor(() => {
            expect(speakMock).toHaveBeenCalledTimes(1)
        })
        expect(screen.getByTestId('chat-bubble-proxy')).toHaveAttribute('data-autospeak', 'false')
    })
})
