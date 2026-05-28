import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HomePage } from '@/pages/HomePage'
import { useKYStore } from '@/stores/kyStore'
import { shareUrl } from '@/lib/shareUtils'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useLocation: () => ({ state: null }),
    }
})

vi.mock('@/lib/db', () => ({
    getLatestSession: vi.fn(async () => null),
}))

vi.mock('@/lib/shareUtils', () => ({
    shareUrl: vi.fn(),
}))

const initialState = useKYStore.getState()

describe('HomePage API token settings', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
        vi.stubEnv('VITE_REQUIRE_API_TOKEN', '0')
        vi.mocked(shareUrl).mockReset()
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        cleanup()
    })

    it('通常環境では新規開始フォームにAPIトークン入力を表示しない', () => {
        render(<HomePage />)

        expect(screen.queryByTestId('input-api-token')).not.toBeInTheDocument()
    })

    it('通常環境では進行中セッション画面にもAPIトークン入力を表示しない', () => {
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')

        render(<HomePage />)

        expect(screen.getByText(/進行中のセッションがあります/)).toBeInTheDocument()
        expect(screen.queryByTestId('input-api-token')).not.toBeInTheDocument()
    })

    it('必須環境（true/yes/1）ではAPIトークン入力を表示する', () => {
        vi.stubEnv('VITE_REQUIRE_API_TOKEN', 'true')

        render(<HomePage />)

        expect(screen.getByTestId('input-api-token')).toBeInTheDocument()
    })

    it('必須環境（yes）でもAPIトークン入力を表示する', () => {
        vi.stubEnv('VITE_REQUIRE_API_TOKEN', 'yes')

        render(<HomePage />)

        expect(screen.getByTestId('input-api-token')).toBeInTheDocument()
    })

    it('共有ボタンからアプリURL共有を呼び出す', async () => {
        vi.mocked(shareUrl).mockResolvedValueOnce('copied')

        render(<HomePage />)

        fireEvent.click(screen.getByTestId('button-share-app'))

        await waitFor(() => {
            expect(shareUrl).toHaveBeenCalledWith({
                title: 'Voice KY Assistant',
                text: '一人KY活動を対話で進められるWebアプリです。',
            })
        })
        expect(await screen.findByText('URLをコピーしました。')).toBeInTheDocument()
    })
})
