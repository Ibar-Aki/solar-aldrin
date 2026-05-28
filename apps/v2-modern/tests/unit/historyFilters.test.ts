import { describe, expect, it } from 'vitest'
import { filterSessionsForHistory } from '@/lib/historyFilters'
import type { SoloKYSession } from '@/types/ky'

function createSession(overrides: Partial<SoloKYSession>): SoloKYSession {
    return {
        id: overrides.id ?? 's1',
        createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
        completedAt: overrides.completedAt ?? overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
        userName: overrides.userName ?? '佐藤',
        siteName: overrides.siteName ?? '中央ビル',
        weather: overrides.weather ?? '晴れ',
        temperature: null,
        processPhase: overrides.processPhase ?? '組み立て',
        healthCondition: 'good',
        workStartTime: '2026-01-01T00:00:00.000Z',
        workEndTime: '2026-01-01T00:10:00.000Z',
        environmentRisk: null,
        workItems: overrides.workItems ?? [
            {
                id: 'w1',
                workDescription: '足場確認',
                hazardDescription: '転落',
                whyDangerous: ['手すり不足'],
                countermeasures: [
                    { category: 'behavior', text: '足元確認' },
                    { category: 'ppe', text: '安全帯使用' },
                ],
                riskLevel: 3,
            },
        ],
        actionGoal: overrides.actionGoal ?? '足元確認ヨシ',
        pointingConfirmed: true,
        safetyChecks: null,
        allMeasuresImplemented: true,
        hadNearMiss: false,
        nearMissNote: null,
    }
}

describe('filterSessionsForHistory', () => {
    it('現場名、工程、危険、対策を横断検索する', () => {
        const sessions = [
            createSession({ id: 'site', siteName: '駅前ビル' }),
            createSession({ id: 'phase', processPhase: '付帯設備設置・仕上げ' }),
            createSession({ id: 'hazard', workItems: [{ ...createSession({}).workItems[0], hazardDescription: '感電' }] }),
            createSession({ id: 'measure', workItems: [{ ...createSession({}).workItems[0], countermeasures: [{ category: 'equipment', text: '絶縁養生' }] }] }),
        ]

        expect(filterSessionsForHistory(sessions, { query: '駅前', dateFilter: 'all' }).map(s => s.id)).toEqual(['site'])
        expect(filterSessionsForHistory(sessions, { query: '仕上げ', dateFilter: 'all' }).map(s => s.id)).toEqual(['phase'])
        expect(filterSessionsForHistory(sessions, { query: '感電', dateFilter: 'all' }).map(s => s.id)).toEqual(['hazard'])
        expect(filterSessionsForHistory(sessions, { query: '絶縁', dateFilter: 'all' }).map(s => s.id)).toEqual(['measure'])
    })

    it('日付フィルタで今日、7日、30日を絞り込む', () => {
        const now = new Date('2026-01-31T12:00:00.000Z')
        const sessions = [
            createSession({ id: 'today', createdAt: '2026-01-31T01:00:00.000Z' }),
            createSession({ id: 'week', createdAt: '2026-01-27T01:00:00.000Z' }),
            createSession({ id: 'month', createdAt: '2026-01-10T01:00:00.000Z' }),
            createSession({ id: 'old', createdAt: '2025-12-01T01:00:00.000Z' }),
        ]

        expect(filterSessionsForHistory(sessions, { query: '', dateFilter: 'today', now }).map(s => s.id)).toEqual(['today'])
        expect(filterSessionsForHistory(sessions, { query: '', dateFilter: '7d', now }).map(s => s.id)).toEqual(['today', 'week'])
        expect(filterSessionsForHistory(sessions, { query: '', dateFilter: '30d', now }).map(s => s.id)).toEqual(['today', 'week', 'month'])
    })
})
