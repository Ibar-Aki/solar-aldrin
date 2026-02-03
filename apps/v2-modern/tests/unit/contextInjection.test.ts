import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildContextInjection } from '@/lib/contextUtils'
import { SoloKYSession } from '@/types/ky'
import * as historyUtils from '@/lib/historyUtils'

// Mock historyUtils
vi.mock('@/lib/historyUtils', () => ({
    getPastRisks: vi.fn(),
    getRecentRisks: vi.fn(),
    getHiyariHattoItems: vi.fn(),
    formatRiskSummary: (entry: any) => `${entry.risk} (${entry.date.slice(0, 10)})`,
    formatHiyariSummary: (entry: any) => `${entry.note} (${entry.date.slice(0, 10)})`
}))

describe('Context Injection', () => {
    const mockSession: SoloKYSession = {
        id: 'current',
        createdAt: '2026-02-01T09:00:00Z',
        updatedAt: '2026-02-01T09:00:00Z',
        workStartTime: '2026-02-01T09:00:00Z',
        userId: 'u1',
        userName: 'Test User',
        siteName: 'Site A',
        weather: '雨', // Triggers weather context
        workItems: [],
        status: 'planning'
    }

    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('should inject weather context', async () => {
        vi.mocked(historyUtils.getPastRisks).mockResolvedValue([])
        vi.mocked(historyUtils.getRecentRisks).mockResolvedValue([])
        vi.mocked(historyUtils.getHiyariHattoItems).mockResolvedValue([])

        const injection = await buildContextInjection({ session: mockSession })

        expect(injection).toContain('【今日のコンテキスト】')
        expect(injection).toContain('雨')
        expect(injection).toContain('滑りやすさと視界不良')
    })

    it('should inject recent risks warning', async () => {
        vi.mocked(historyUtils.getRecentRisks).mockResolvedValue([
            { risk: 'Slippery floor', date: '2026-01-31T09:00:00Z', sessionId: 's1', siteName: 'Site A', workDescription: null }
        ])
        vi.mocked(historyUtils.getPastRisks).mockResolvedValue([])
        vi.mocked(historyUtils.getHiyariHattoItems).mockResolvedValue([])

        const injection = await buildContextInjection({ session: mockSession })

        expect(injection).toContain('【直近3日以内に同様の危険】')
        expect(injection).toContain('Slippery floor')
        expect(injection).toContain('連日同じ危険が挙がっています')
    })

    it('should inject past hiyari hatto', async () => {
        vi.mocked(historyUtils.getHiyariHattoItems).mockResolvedValue([
            { note: 'Dropped hammer', date: '2026-01-15T09:00:00Z', sessionId: 'h1', siteName: 'Site A' }
        ])
        vi.mocked(historyUtils.getPastRisks).mockResolvedValue([])
        vi.mocked(historyUtils.getRecentRisks).mockResolvedValue([])

        const injection = await buildContextInjection({ session: mockSession })

        expect(injection).toContain('【過去のヒヤリハット】')
        expect(injection).toContain('Dropped hammer')
    })
})
