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

describe('HomePage focus style preview', () => {
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

    it('A案本番採用後は比較モデルをHome画面に表示しない', () => {
        render(<HomePage />)
        expect(screen.queryByTestId('focus-style-preview')).not.toBeInTheDocument()
    })
})
