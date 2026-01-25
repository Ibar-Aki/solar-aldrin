/**
 * 一人KY セッション用 Zustand ストア
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { SoloKYSession, WorkItem, ChatMessage, SessionStatus, ExtractedData } from '@/types/ky'

/** 現在時刻をISO 8601形式で取得 */
const now = () => new Date().toISOString()

/** 空のWorkItemを作成 */
const createEmptyWorkItem = (): Partial<WorkItem> => ({
    id: uuidv4(),
    whyDangerous: [],
    countermeasures: [],
})

interface KYStore {
    // === State ===
    session: SoloKYSession | null
    status: SessionStatus
    messages: ChatMessage[]
    currentWorkItem: Partial<WorkItem>
    isLoading: boolean
    error: string | null

    // === Actions: Session ===
    startSession: (userName: string, siteName: string, weather: string, temperature?: number) => void
    completeSession: (data: {
        actionGoal: string
        pointingConfirmed: boolean
        allMeasuresImplemented: boolean
        hadNearMiss: boolean
        nearMissNote?: string
    }) => void
    clearSession: () => void

    // === Actions: WorkItem ===
    updateCurrentWorkItem: (data: Partial<WorkItem>) => void
    commitWorkItem: () => void
    startNewWorkItem: () => void

    // === Actions: Chat ===
    addMessage: (role: 'user' | 'assistant', content: string, extractedData?: ExtractedData) => void
    clearMessages: () => void

    // === Actions: Status ===
    setStatus: (status: SessionStatus) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void

    // === Actions: Environment ===
    setEnvironmentRisk: (risk: string) => void
}

export const useKYStore = create<KYStore>()(
    persist(
        (set, get) => ({
            // === Initial State ===
            session: null,
            status: 'basic_info',
            messages: [],
            currentWorkItem: createEmptyWorkItem(),
            isLoading: false,
            error: null,

            // === Session Actions ===
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
                    currentWorkItem: createEmptyWorkItem(),
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

            clearSession: () => {
                set({
                    session: null,
                    status: 'basic_info',
                    messages: [],
                    currentWorkItem: createEmptyWorkItem(),
                    error: null,
                })
            },

            // === WorkItem Actions ===
            updateCurrentWorkItem: (data) => {
                set((state) => ({
                    currentWorkItem: { ...state.currentWorkItem, ...data },
                }))
            },

            commitWorkItem: () => {
                const { session, currentWorkItem } = get()
                if (!session) return

                // 必須フィールドのチェック
                if (
                    !currentWorkItem.workDescription ||
                    !currentWorkItem.hazardDescription ||
                    !currentWorkItem.riskLevel ||
                    !currentWorkItem.whyDangerous?.length ||
                    !currentWorkItem.countermeasures?.length
                ) {
                    set({ error: '作業項目が不完全です' })
                    return
                }

                const completeItem: WorkItem = {
                    id: currentWorkItem.id || uuidv4(),
                    workDescription: currentWorkItem.workDescription,
                    hazardDescription: currentWorkItem.hazardDescription,
                    riskLevel: currentWorkItem.riskLevel as 1 | 2 | 3 | 4 | 5,
                    whyDangerous: currentWorkItem.whyDangerous,
                    countermeasures: currentWorkItem.countermeasures,
                }

                set({
                    session: {
                        ...session,
                        workItems: [...session.workItems, completeItem],
                    },
                    currentWorkItem: createEmptyWorkItem(),
                    error: null,
                })
            },

            startNewWorkItem: () => {
                set({ currentWorkItem: createEmptyWorkItem() })
            },

            // === Chat Actions ===
            addMessage: (role, content, extractedData) => {
                const message: ChatMessage = {
                    id: uuidv4(),
                    role,
                    content,
                    timestamp: now(),
                    extractedData,
                }
                set((state) => ({
                    messages: [...state.messages, message],
                }))
            },

            clearMessages: () => set({ messages: [] }),

            // === Status Actions ===
            setStatus: (status) => set({ status }),
            setLoading: (isLoading) => set({ isLoading }),
            setError: (error) => set({ error }),

            // === Environment Actions ===
            setEnvironmentRisk: (risk) => {
                const session = get().session
                if (!session) return
                set({
                    session: { ...session, environmentRisk: risk },
                })
            },
        }),
        {
            name: 'voice-ky-v2-session',
            partialize: (state) => ({
                session: state.session,
                messages: state.messages,
                currentWorkItem: state.currentWorkItem,
                status: state.status,
            }),
        }
    )
)
