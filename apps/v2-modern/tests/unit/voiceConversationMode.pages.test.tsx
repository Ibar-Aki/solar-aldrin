import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HomePage } from '@/pages/HomePage'
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

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useLocation: () => ({ state: null }),
    }
})

vi.mock('@/lib/db', () => ({
    getLatestSession: vi.fn(() => new Promise(() => {})),
}))

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

const initialKYState = useKYStore.getState()

describe('Voice conversation mode switch', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        useKYStore.setState(initialKYState, true)
        useVoiceConversationModeStore.setState({ mode: 'normal' })
        window.localStorage.clear()
    })

    it('ホーム画面は通常モードを初期表示し、切替できる', () => {
        render(<HomePage />)

        expect(screen.getByTestId('mode-normal')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('mode-full-voice')).toHaveAttribute('aria-pressed', 'false')

        fireEvent.click(screen.getByTestId('mode-full-voice'))

        expect(useVoiceConversationModeStore.getState().mode).toBe('full_voice')
        expect(screen.getByTestId('mode-full-voice')).toHaveAttribute('aria-pressed', 'true')
    })

    it('ホームで切替えた状態を会話画面でも共有し、会話画面から戻せる', () => {
        render(<HomePage />)
        fireEvent.click(screen.getByTestId('mode-full-voice'))
        cleanup()

        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')
        render(<KYSessionPage />)

        expect(screen.getByTestId('mode-full-voice')).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(screen.getByTestId('mode-normal'))
        expect(useVoiceConversationModeStore.getState().mode).toBe('normal')
        expect(screen.getByTestId('mode-normal')).toHaveAttribute('aria-pressed', 'true')
    })
})
