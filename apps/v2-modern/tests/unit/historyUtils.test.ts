import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db, saveSession, getPastRisks, applyHistoryRetention, getRecentRisks, getHiyariHattoItems } from '@/lib/db'
import { SoloKYSession } from '@/types/ky'
import * as historyUtils from '@/lib/historyUtils'

// Mock session generator
const createSession = (id: string, date: string, hazard: string, siteName = 'Site A'): SoloKYSession => ({
    id,
    createdAt: date,
    updatedAt: date,
    completedAt: date,
    userId: 'user1',
    userName: 'Test User',
    siteName,
    weather: 'Sunny',
    processPhase: 'Test Phase',
    healthCondition: 'Good',
    workItems: [
        {
            id: 'w1',
            workDescription: 'Test Work',
            hazardDescription: hazard,
            situation: 'Test Situation',
            countermeasures: ['Measure 1'],
            riskLevel: 3,
            completed: true
        }
    ],
    actionGoal: 'Goal 1',
    status: 'completed'
})

describe('History Utils', () => {
    beforeEach(async () => {
        await db.sessions.clear()
        historyUtils.resetRetentionState()
    })

    describe('Risk Filtering', () => {
        it('should filter past risks by similarity', async () => {
            const today = new Date().toISOString()
            const yesterday = new Date(Date.now() - 86400000).toISOString()

            // Setup past sessions
            await saveSession(createSession('s1', today, 'Falling from height', 'Factory Alpha'))
            await saveSession(createSession('s2', yesterday, 'Electric shock', 'Factory Alpha'))
            await saveSession(createSession('s3', today, 'Falling object', 'Office Beta')) // Different site

            // Test getPastRisks
            const risks = await historyUtils.getPastRisks(5, { siteName: 'Factory Alpha' })

            expect(risks).toHaveLength(2)
            expect(risks.map(r => r.risk)).toContain('Falling from height')
            expect(risks.map(r => r.risk)).toContain('Electric shock')
            expect(risks.map(r => r.risk)).not.toContain('Falling object')
        })

        it('should exclude current session ID', async () => {
            await saveSession(createSession('current', '2026-01-01T10:00:00Z', 'Current risk'))

            const risks = await historyUtils.getPastRisks(5, { excludeSessionId: 'current' })
            expect(risks).toHaveLength(0)
        })
    })

    describe('Retention Policy', () => {
        it('should enforce retention policy (max items)', async () => {
            // Insert 105 sessions
            const sessions: SoloKYSession[] = []
            for (let i = 0; i < 105; i++) {
                // Older dates first
                const date = new Date(Date.now() - (105 - i) * 60000).toISOString()
                sessions.push(createSession(`s-${i}`, date, `Risk ${i}`))
            }

            await db.sessions.bulkAdd(sessions)

            // Setup for retention test
            // We need to ensure retention runs. Since it might have run in previous tests (indirectly),
            // we need a way to force it.
            // But since I cannot easily reset the module state without modifying source,
            // I will modify `src/lib/historyUtils.ts` first to allow resetting.

            await new Promise(r => setTimeout(r, 100))

            // Apply retention
            await historyUtils.applyHistoryRetention()

            const count = await db.sessions.count()
            expect(count).toBeLessThanOrEqual(100)

            // Newest should remain
            const newest = await db.sessions.orderBy('createdAt').last()
            expect(newest?.id).toBe('s-104')
        })
    })

    describe('Recent Risks', () => {
        it('should retrieve risks within specified days', async () => {
            const today = new Date()
            const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
            const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)

            await saveSession(createSession('s1', today.toISOString(), 'Today Risk'))
            await saveSession(createSession('s2', yesterday.toISOString(), 'Yesterday Risk'))
            await saveSession(createSession('s3', weekAgo.toISOString(), 'Old Risk'))

            const recent = await historyUtils.getRecentRisks(3)
            const risks = recent.map(r => r.risk)

            expect(risks).toContain('Today Risk')
            expect(risks).toContain('Yesterday Risk')
            expect(risks).not.toContain('Old Risk')
        })
    })

    describe('Hiyari Hatto', () => {
        it('should retrieve hiyari hatto items', async () => {
            const s1 = createSession('h1', new Date().toISOString(), 'Risk 1')
            s1.hadNearMiss = true
            s1.nearMissNote = 'Almost slipped'

            const s2 = createSession('h2', new Date().toISOString(), 'Risk 2')
            s2.hadNearMiss = false

            await saveSession(s1)
            await saveSession(s2)

            const hiyari = await historyUtils.getHiyariHattoItems()
            expect(hiyari).toHaveLength(1)
            expect(hiyari[0].note).toBe('Almost slipped')
        })
    })
})
