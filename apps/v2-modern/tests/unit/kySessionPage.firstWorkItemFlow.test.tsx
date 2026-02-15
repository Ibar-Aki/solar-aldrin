import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { KYSessionPage } from '@/pages/KYSessionPage'
import { useKYStore } from '@/stores/kyStore'

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

const initialState = useKYStore.getState()

describe('KYSessionPage first work item flow', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        sendMessageMock.mockReset()
        completeFirstWorkItemMock.mockReset()
        completeSecondWorkItemMock.mockReset()
        applyRiskLevelSelectionMock.mockReset()
        completeSafetyConfirmationMock.mockReset()
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

    it('2件目で対策2件が揃うと「2件目完了」ボタンを表示して押下できる', () => {
        const { updateCurrentWorkItem, commitWorkItem } = useKYStore.getState()
        updateCurrentWorkItem({
            workDescription: '足場上で資材を運ぶ',
            hazardDescription: '転落する',
            riskLevel: 4,
            whyDangerous: ['足元が滑りやすい'],
            countermeasures: [
                { category: 'equipment', text: '手すりを設置する' },
                { category: 'behavior', text: '監視員を配置する' },
            ],
        })
        commitWorkItem()

        useKYStore.getState().updateCurrentWorkItem({
            workDescription: 'グラインダーで切断する',
            hazardDescription: '火花が飛散して火災になる',
            riskLevel: 5,
            whyDangerous: ['周囲の養生が不十分'],
            countermeasures: [
                { category: 'equipment', text: '消火器を手元に置く' },
                { category: 'behavior', text: '火気監視を配置する' },
            ],
        })

        render(<KYSessionPage />)

        const button = screen.getByTestId('button-complete-second-work-item')
        expect(button).toBeInTheDocument()
        fireEvent.click(button)
        expect(completeSecondWorkItemMock).toHaveBeenCalledTimes(1)
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

    it('confirmation時は4項目チェックが揃うまで完了ボタンを無効化し、揃うと完了処理を呼ぶ', () => {
        const { updateCurrentWorkItem, commitWorkItem, updateActionGoal, setStatus } = useKYStore.getState()
        updateCurrentWorkItem({
            workDescription: '作業1',
            hazardDescription: '危険1',
            riskLevel: 3,
            whyDangerous: ['要因1'],
            countermeasures: [
                { category: 'equipment', text: '設備対策1' },
                { category: 'ppe', text: '保護具対策1' },
            ],
        })
        commitWorkItem()
        updateCurrentWorkItem({
            workDescription: '作業2',
            hazardDescription: '危険2',
            riskLevel: 3,
            whyDangerous: ['要因2'],
            countermeasures: [
                { category: 'equipment', text: '設備対策2' },
                { category: 'ppe', text: '保護具対策2' },
            ],
        })
        commitWorkItem()
        updateActionGoal('火気使用時の完全養生よし！')
        setStatus('confirmation')

        render(<KYSessionPage />)

        expect(screen.getByTestId('safety-checklist-panel')).toBeInTheDocument()
        expect(screen.queryByPlaceholderText('メッセージを入力...')).not.toBeInTheDocument()

        const completeButton = screen.getByTestId('button-complete-safety-checks')
        expect(completeButton).toBeDisabled()

        fireEvent.click(screen.getByTestId('safety-check-pointAndCall'))
        fireEvent.click(screen.getByTestId('safety-check-toolAndWireInspection'))
        fireEvent.click(screen.getByTestId('safety-check-ppeReady'))
        fireEvent.click(screen.getByTestId('safety-check-evacuationRouteAndContact'))

        expect(completeButton).not.toBeDisabled()
        fireEvent.click(completeButton)
        expect(completeSafetyConfirmationMock).toHaveBeenCalledTimes(1)
    })
})
