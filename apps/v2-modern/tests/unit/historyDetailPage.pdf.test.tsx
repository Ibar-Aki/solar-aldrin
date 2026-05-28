import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryDetailPage } from '@/pages/HistoryDetailPage'
import type { SoloKYSession } from '@/types/ky'
import { getSessionById } from '@/lib/db'

const navigateMock = vi.fn()
const pdfMocks = vi.hoisted(() => ({
    generateAndDownload: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useParams: () => ({ id: 'session-1' }),
    }
})

vi.mock('@/lib/db', () => ({
    getSessionById: vi.fn(),
    deleteSession: vi.fn(),
}))

vi.mock('@/hooks/usePDFGenerator', () => ({
    usePDFGenerator: () => ({
        generateAndDownload: pdfMocks.generateAndDownload,
        isGenerating: false,
    }),
}))

const session: SoloKYSession = {
    id: 'session-1',
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

describe('HistoryDetailPage PDF export', () => {
    beforeEach(() => {
        navigateMock.mockReset()
        pdfMocks.generateAndDownload.mockReset()
        vi.mocked(getSessionById).mockResolvedValue(session)
    })

    afterEach(() => {
        cleanup()
    })

    it('履歴詳細からPDFを再出力できる', async () => {
        render(<HistoryDetailPage />)

        fireEvent.click(await screen.findByTestId('button-history-pdf'))

        await waitFor(() => {
            expect(pdfMocks.generateAndDownload).toHaveBeenCalledWith(session)
        })
    })
})
