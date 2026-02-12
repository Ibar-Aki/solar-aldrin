import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { KYSessionPage } from '@/pages/KYSessionPage'
import { useKYStore } from '@/stores/kyStore'

const navigateMock = vi.fn()
const sendMessageMock = vi.fn()
const completeFirstWorkItemMock = vi.fn()
const applyRiskLevelSelectionMock = vi.fn()
const initializeChatMock = vi.fn()
const retryLastMessageMock = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
    }
})

vi.mock('@/hooks/useChat', () => ({
    useChat: () => ({
        sendMessage: sendMessageMock,
        completeFirstWorkItem: completeFirstWorkItemMock,
        applyRiskLevelSelection: applyRiskLevelSelectionMock,
        initializeChat: initializeChatMock,
        retryLastMessage: retryLastMessageMock,
        canRetry: false,
    }),
}))

const initialState = useKYStore.getState()

describe('KYSessionPage first work item flow', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        sendMessageMock.mockReset()
        completeFirstWorkItemMock.mockReset()
        applyRiskLevelSelectionMock.mockReset()
        initializeChatMock.mockReset()
        retryLastMessageMock.mockReset()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')
    })

    it('1件目で対策2件が揃うと「1件目完了」ボタンを表示する', () => {
        useKYStore.getState().updateCurrentWorkItem({
            workDescription: '足場上で資材を運ぶ',
            hazardDescription: '転落する',
            riskLevel: 4,
            whyDangerous: ['足元が滑りやすい'],
            countermeasures: [
                { category: 'equipment', text: '手すりを設置する' },
                { category: 'behavior', text: '監視員を配置する' },
            ],
        })

        render(<KYSessionPage />)

        expect(screen.getByTestId('button-complete-first-work-item')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('メッセージを入力...')).toBeInTheDocument()
    })

    it('進捗バーに参考情報ボタンを表示し、国交省PDFリンクを設定する', () => {
        render(<KYSessionPage />)

        const link = screen.getByRole('link', { name: '参考情報（国土交通省PDF）を開く' })
        expect(link).toBeInTheDocument()
        expect(link).toHaveAttribute('href', 'https://www.mlit.go.jp/common/001187973.pdf')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('1件目で対策3件が揃ったら入力欄を隠し、完了ボタンのみ表示する', () => {
        useKYStore.getState().updateCurrentWorkItem({
            workDescription: '足場上で資材を運ぶ',
            hazardDescription: '転落する',
            riskLevel: 4,
            whyDangerous: ['足元が滑りやすい'],
            countermeasures: [
                { category: 'equipment', text: '手すりを設置する' },
                { category: 'behavior', text: '監視員を配置する' },
                { category: 'ppe', text: 'フルハーネスを二丁掛けで使用する' },
            ],
        })

        render(<KYSessionPage />)

        expect(screen.getByTestId('button-complete-first-work-item')).toBeInTheDocument()
        expect(screen.queryByPlaceholderText('メッセージを入力...')).not.toBeInTheDocument()
    })

    it('KYボードのサイズ切替は拡大を初期値にし、縮小/拡大を切り替えできる', () => {
        render(<KYSessionPage />)

        expect(screen.getByTestId('ky-board-card')).toHaveAttribute('data-scale', 'expanded')
        expect(screen.getByTestId('ky-board-scale-expanded')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('ky-board-scale-compact')).toHaveAttribute('aria-pressed', 'false')

        fireEvent.click(screen.getByTestId('ky-board-scale-compact'))
        expect(screen.getByTestId('ky-board-card')).toHaveAttribute('data-scale', 'compact')
        expect(screen.getByTestId('ky-board-scale-expanded')).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByTestId('ky-board-scale-compact')).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(screen.getByTestId('ky-board-scale-expanded'))
        expect(screen.getByTestId('ky-board-card')).toHaveAttribute('data-scale', 'expanded')
        expect(screen.getByTestId('ky-board-scale-expanded')).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByTestId('ky-board-scale-compact')).toHaveAttribute('aria-pressed', 'false')
    })
})
