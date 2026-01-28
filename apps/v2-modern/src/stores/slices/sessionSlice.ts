import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { SoloKYSession, SessionStatus } from '@/types/ky'
import type { KYStore } from '../kyStore'

export interface SessionSlice {
    session: SoloKYSession | null
    status: SessionStatus

    startSession: (userName: string, siteName: string, weather: string, temperature?: number) => void
    completeSession: (data: {
        actionGoal: string
        pointingConfirmed: boolean
        allMeasuresImplemented: boolean
        hadNearMiss: boolean
        nearMissNote?: string
    }) => void
    updateActionGoal: (goal: string) => void
    setEnvironmentRisk: (risk: string) => void
    setStatus: (status: SessionStatus) => void
    clearSession: () => void
}

const now = () => new Date().toISOString()

export const createSessionSlice: StateCreator<KYStore, [], [], SessionSlice> = (set, get) => ({
    session: null,
    status: 'basic_info',

    startSession: (userName, siteName, weather, temperature) => {
        const session: SoloKYSession = {
            id: uuidv4(),
            userName,
            siteName,
            weather,
            temperature: temperature ?? null,
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
        set({
            session: {
                ...session,
                actionGoal: data.actionGoal,
                pointingConfirmed: data.pointingConfirmed,
                allMeasuresImplemented: data.allMeasuresImplemented,
                hadNearMiss: data.hadNearMiss,
                nearMissNote: data.nearMissNote ?? null,
                workEndTime: now(),
                completedAt: now(),
            },
            status: 'completed',
        })
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
