import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SoloKYSession, SessionStatus, ProcessPhase, HealthCondition } from '@/types/ky'
import type { KYStore } from '../kyStore'
import { saveSession } from '@/lib/db'

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
        actionGoal: string
        pointingConfirmed: boolean
        allMeasuresImplemented: boolean
        hadNearMiss: boolean
        nearMissNote?: string
    }) => void
    /** セッションをIndexedDBに保存（非同期） */
    saveSessionToDb: () => Promise<boolean>
    updateActionGoal: (goal: string) => void
    setEnvironmentRisk: (risk: string) => void
    setStatus: (status: SessionStatus) => void
    clearSession: () => void
}

const now = () => new Date().toISOString()

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
        })
    },

    completeSession: (data) => {
        const session = get().session
        if (!session) return
        // レビュー指摘: 完了後のセッションオブジェクトを組み立てる
        const completedSession: SoloKYSession = {
            ...session,
            actionGoal: data.actionGoal,
            pointingConfirmed: data.pointingConfirmed,
            allMeasuresImplemented: data.allMeasuresImplemented,
            hadNearMiss: data.hadNearMiss,
            nearMissNote: data.nearMissNote ?? null,
            workEndTime: now(),
            completedAt: now(),
        }
        set({
            session: completedSession,
            status: 'completed',
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
        })
    },
})


