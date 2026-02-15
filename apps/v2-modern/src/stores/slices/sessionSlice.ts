import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SoloKYSession, SessionStatus, ProcessPhase, HealthCondition, SafetyConfirmationChecks } from '@/types/ky'
import type { KYStore } from '../kyStore'
import { saveSession } from '@/lib/db'
import { sendTelemetry } from '@/lib/observability/telemetry'
import { applyHistoryRetention } from '@/lib/historyUtils'

export interface SessionSlice {
    session: SoloKYSession | null
    status: SessionStatus

    startSession: (
        userName: string,
        siteName: string,
        weather: string,
        processPhase: ProcessPhase,
        healthCondition: HealthCondition,
        temperature?: number
    ) => void
    completeSession: (data: {
        actionGoal: string | null
        pointingConfirmed: boolean | null
        safetyChecks?: SafetyConfirmationChecks | null
        allMeasuresImplemented: boolean | null
        hadNearMiss: boolean | null
        nearMissNote?: string | null
    }) => void
    /** セッションをIndexedDBに保存（非同期） */
    saveSessionToDb: () => Promise<boolean>
    updateActionGoal: (goal: string) => void
    setEnvironmentRisk: (risk: string) => void
    setStatus: (status: SessionStatus) => void
    clearSession: () => void
}

const now = () => new Date().toISOString()

function countInputLength(session: SoloKYSession): number {
    let total = 0
    const add = (value?: string | null) => {
        if (value) total += value.length
    }

    add(session.userName)
    add(session.siteName)
    add(session.weather)
    add(session.actionGoal)
    add(session.nearMissNote)

    for (const item of session.workItems) {
        add(item.workDescription)
        add(item.hazardDescription)
        for (const why of item.whyDangerous) add(why)
        for (const measure of item.countermeasures) add(measure.text)
    }

    return total
}

export const createSessionSlice: StateCreator<KYStore, [], [], SessionSlice> = (set, get) => ({
    session: null,
    status: 'basic_info',

    startSession: (userName, siteName, weather, processPhase, healthCondition, temperature) => {
        const session: SoloKYSession = {
            id: uuidv4(),
            userName,
            siteName,
            weather,
            temperature: temperature ?? null,
            processPhase,
            healthCondition,
            workStartTime: now(),
            workEndTime: null,
            createdAt: now(),
            environmentRisk: null,
            workItems: [],
            actionGoal: null,
            pointingConfirmed: null,
            safetyChecks: null,
            allMeasuresImplemented: null,
            hadNearMiss: null,
            nearMissNote: null,
            completedAt: null,
        }
        set({
            session,
            status: 'work_items',
            messages: [],
            currentWorkItem: {
                id: uuidv4(),
                whyDangerous: [],
                countermeasures: [],
            },
            error: null,
            errorSource: null,
            feedback: null,
            supplements: [],
            polishedGoal: null,
            polishedActionGoal: null,
            feedbackLoading: false,
            feedbackError: null,
            feedbackSkipped: false,
            feedbackSessionId: null,
        })

        void sendTelemetry({
            event: 'session_start',
            sessionId: session.id,
            data: {
                weather: session.weather,
                processPhase: session.processPhase ?? 'unknown',
                healthCondition: session.healthCondition ?? 'unknown',
            },
        })
    },

    completeSession: (data) => {
        const session = get().session
        if (!session) return
        const resolvedSafetyChecks = data.safetyChecks ?? session.safetyChecks ?? null
        const allSafetyChecksDone = resolvedSafetyChecks
            ? Object.values(resolvedSafetyChecks).every(Boolean)
            : null
        // レビュー指摘: 完了後のセッションオブジェクトを組み立てる
        const completedSession: SoloKYSession = {
            ...session,
            actionGoal: data.actionGoal,
            pointingConfirmed: data.pointingConfirmed ?? resolvedSafetyChecks?.pointAndCall ?? null,
            safetyChecks: resolvedSafetyChecks,
            allMeasuresImplemented: data.allMeasuresImplemented ?? allSafetyChecksDone,
            hadNearMiss: data.hadNearMiss,
            nearMissNote: data.nearMissNote ?? null,
            workEndTime: now(),
            completedAt: now(),
        }
        set({
            session: completedSession,
            status: 'completed',
        })

        const completedAt = completedSession.completedAt ?? now()
        const durationMs = new Date(completedAt).getTime() - new Date(completedSession.workStartTime).getTime()
        const inputLength = countInputLength(completedSession)

        void sendTelemetry({
            event: 'session_complete',
            sessionId: completedSession.id,
            value: durationMs,
            data: {
                durationMs,
                inputLength,
                workItemCount: completedSession.workItems.length,
                hadNearMiss: completedSession.hadNearMiss ?? false,
            },
        })
    },

    /** IndexedDBに保存（put で冪等） */
    saveSessionToDb: async () => {
        const session = get().session
        if (!session || !session.completedAt) {
            // FIX-10: DEV環境のみログ出力
            if (import.meta.env.DEV) console.warn('Cannot save: session not completed')
            return false
        }
        try {
            await saveSession(session)
            try {
                await applyHistoryRetention()
            } catch (error) {
                console.warn('History retention failed after save:', error)
            }
            if (import.meta.env.DEV) console.log('Session saved to IndexedDB:', session.id)
            return true
        } catch (e) {
            console.error('Failed to save session to IndexedDB:', e) // エラーは常に出力
            return false
        }
    },

    updateActionGoal: (goal) => {
        const session = get().session
        if (!session) return
        set({
            session: { ...session, actionGoal: goal }
        })
    },

    setEnvironmentRisk: (risk) => {
        const session = get().session
        if (!session) return
        set({
            session: { ...session, environmentRisk: risk },
        })
    },

    setStatus: (status) => set({ status }),

    clearSession: () => {
        set({
            session: null,
            status: 'basic_info',
            messages: [],
            currentWorkItem: {
                id: uuidv4(),
                whyDangerous: [],
                countermeasures: [],
            },
            error: null,
            errorSource: null,
            feedback: null,
            supplements: [],
            polishedGoal: null,
            polishedActionGoal: null,
            feedbackLoading: false,
            feedbackError: null,
            feedbackSkipped: false,
            feedbackSessionId: null,
        })
    },
})


