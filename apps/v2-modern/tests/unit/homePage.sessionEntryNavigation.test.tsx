import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

describe('HomePage session entry navigation', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
    })

    it('新規開始時は entry=new を付与して session へ遷移する', () => {
        render(<HomePage />)

        fireEvent.change(screen.getByTestId('input-username'), { target: { value: '田中太郎' } })
        fireEvent.change(screen.getByTestId('input-sitename'), { target: { value: 'テスト現場' } })
        fireEvent.click(screen.getByTestId('button-start-ky'))

        expect(navigateMock).toHaveBeenCalledWith('/session', { state: { entry: 'new' } })
    })

    it('再開時は entry=resume を付与して session へ遷移する', () => {
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')
        render(<HomePage />)

        fireEvent.click(screen.getByRole('button', { name: '続きから再開' }))

        expect(navigateMock).toHaveBeenCalledWith('/session', { state: { entry: 'resume' } })
    })
})
