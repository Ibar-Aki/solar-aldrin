import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HomePage } from '@/pages/HomePage'
import { useKYStore } from '@/stores/kyStore'

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

const initialState = useKYStore.getState()

describe('HomePage API token settings', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
        vi.stubEnv('VITE_REQUIRE_API_TOKEN', '0')
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
})
