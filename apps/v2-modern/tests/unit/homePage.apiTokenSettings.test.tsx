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
    })

    afterEach(() => {
        cleanup()
    })

    it('新規開始フォームでAPIトークン入力を表示する', () => {
        render(<HomePage />)

        expect(screen.getByTestId('input-api-token')).toBeInTheDocument()
    })

    it('進行中セッション画面でもAPIトークン入力を表示する', () => {
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')

        render(<HomePage />)

        expect(screen.getByText(/進行中のセッションがあります/)).toBeInTheDocument()
        expect(screen.getByTestId('input-api-token')).toBeInTheDocument()
    })
})
