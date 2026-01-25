import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// KYセッションの状態
export interface KYSession {
    id: string
    location: string
    weather: string
    hazards: string[]
    countermeasures: string[]
    conversation: { role: 'user' | 'assistant'; content: string }[]
    status: 'in_progress' | 'completed'
    createdAt: string
    completedAt?: string
}

// アプリ全体の状態
interface AppState {
    // ユーザー認証状態
    isLoggedIn: boolean
    userId: string | null

    // 現在のKYセッション
    currentSession: KYSession | null

    // 音声認識の状態
    isListening: boolean
    isSpeaking: boolean

    // アクション
    setListening: (listening: boolean) => void
    setSpeaking: (speaking: boolean) => void
    startNewSession: (location: string, weather: string) => void
    addMessage: (role: 'user' | 'assistant', content: string) => void
    addHazard: (hazard: string) => void
    addCountermeasure: (countermeasure: string) => void
    completeSession: () => void
    clearSession: () => void
    setUser: (userId: string | null, isLoggedIn: boolean) => void
}

// ユニークIDの生成
const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            isLoggedIn: false,
            userId: null,
            currentSession: null,
            isListening: false,
            isSpeaking: false,

            setListening: (listening) => set({ isListening: listening }),
            setSpeaking: (speaking) => set({ isSpeaking: speaking }),

            startNewSession: (location, weather) => {
                const newSession: KYSession = {
                    id: generateId(),
                    location,
                    weather,
                    hazards: [],
                    countermeasures: [],
                    conversation: [],
                    status: 'in_progress',
                    createdAt: new Date().toISOString(),
                }
                set({ currentSession: newSession })
            },

            addMessage: (role, content) => {
                const session = get().currentSession
                if (session) {
                    set({
                        currentSession: {
                            ...session,
                            conversation: [...session.conversation, { role, content }],
                        },
                    })
                }
            },

            addHazard: (hazard) => {
                const session = get().currentSession
                if (session) {
                    set({
                        currentSession: {
                            ...session,
                            hazards: [...session.hazards, hazard],
                        },
                    })
                }
            },

            addCountermeasure: (countermeasure) => {
                const session = get().currentSession
                if (session) {
                    set({
                        currentSession: {
                            ...session,
                            countermeasures: [...session.countermeasures, countermeasure],
                        },
                    })
                }
            },

            completeSession: () => {
                const session = get().currentSession
                if (session) {
                    set({
                        currentSession: {
                            ...session,
                            status: 'completed',
                            completedAt: new Date().toISOString(),
                        },
                    })
                }
            },

            clearSession: () => set({ currentSession: null }),

            setUser: (userId, isLoggedIn) => set({ userId, isLoggedIn }),
        }),
        {
            name: 'voice-ky-v2-storage',
            partialize: (state) => ({
                // localStorageに保持する項目
                isLoggedIn: state.isLoggedIn,
                userId: state.userId,
                currentSession: state.currentSession,
            }),
        }
    )
)
