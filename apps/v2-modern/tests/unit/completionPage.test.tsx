import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CompletionPage } from '@/pages/CompletionPage'
import { useKYStore } from '@/stores/kyStore'
import type { SoloKYSession } from '@/types/ky'

const navigateMock = vi.fn()
const pdfMocks = vi.hoisted(() => ({
    generateAndDownload: vi.fn(),
    generateAndShare: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
    }
})

vi.mock('@/hooks/usePDFGenerator', () => ({
    usePDFGenerator: () => ({
        generateAndDownload: pdfMocks.generateAndDownload,
        generateAndShare: pdfMocks.generateAndShare,
        isGenerating: false,
    }),
}))

vi.mock('@/lib/historyUtils', () => ({
    getRecentRiskMatches: vi.fn(async () => []),
}))

const initialState = useKYStore.getState()

const completedSession: SoloKYSession = {
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z',
    userName: 'Test User',
    siteName: 'Test Site',
    weather: '晴れ',
    temperature: null,
    processPhase: 'フリー',
    healthCondition: 'good',
    workStartTime: '2026-01-01T00:00:00.000Z',
    workEndTime: '2026-01-01T00:10:00.000Z',
    environmentRisk: null,
    workItems: [
        {
            id: 'w1',
            workDescription: '足場確認',
            hazardDescription: '転落',
            whyDangerous: ['手すりがない'],
            countermeasures: [
                { category: 'behavior', text: '足元確認' },
                { category: 'ppe', text: '安全帯使用' },
            ],
            riskLevel: 3,
        },
    ],
    actionGoal: '足元確認ヨシ',
    pointingConfirmed: true,
    safetyChecks: null,
    allMeasuresImplemented: true,
    hadNearMiss: false,
    nearMissNote: null,
}

describe('CompletionPage', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        pdfMocks.generateAndDownload.mockReset()
        pdfMocks.generateAndShare.mockReset()
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

    it('PDF共有非対応時はダウンロードフォールバック結果を表示する', async () => {
        pdfMocks.generateAndShare.mockResolvedValueOnce('downloaded')
        useKYStore.setState({
            ...useKYStore.getState(),
            session: completedSession,
            status: 'completed',
            feedbackLoading: false,
            feedbackSessionId: completedSession.id,
            saveSessionToDb: vi.fn(async () => true),
        })

        render(<CompletionPage />)

        fireEvent.click(screen.getByTestId('button-share-pdf'))

        await waitFor(() => {
            expect(pdfMocks.generateAndShare).toHaveBeenCalled()
        })
        expect(await screen.findByText('共有非対応のためPDFをダウンロードしました。')).toBeInTheDocument()
    })
})
