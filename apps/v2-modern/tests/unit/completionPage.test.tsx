import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { CompletionPage } from '@/pages/CompletionPage'
import { useKYStore } from '@/stores/kyStore'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
    }
})

vi.mock('@/hooks/usePDFGenerator', () => ({
    usePDFGenerator: () => ({
        generateAndDownload: vi.fn(),
        isGenerating: false,
    }),
}))

const initialState = useKYStore.getState()

describe('CompletionPage', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
    })

    afterEach(() => {
        cleanup()
    })

    it('未完了セッションでは完了化せず /session へ戻す', async () => {
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')

        render(<CompletionPage />)

        await waitFor(() => {
            expect(navigateMock).toHaveBeenCalledWith('/session')
        })

        const state = useKYStore.getState()
        expect(state.status).toBe('work_items')
        expect(state.session?.completedAt).toBeNull()
    })
})
