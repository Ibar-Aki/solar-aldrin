/**
 * 一人KY セッション用 Zustand ストア (Refactored: Sliced)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice'
import { createWorkItemSlice, type WorkItemSlice } from './slices/workItemSlice'
import { createChatSlice, type ChatSlice } from './slices/chatSlice'
import { createFeedbackSlice, type FeedbackSlice } from './slices/feedbackSlice'

export type KYStore = SessionSlice & WorkItemSlice & ChatSlice & FeedbackSlice

export const useKYStore = create<KYStore>()(
    persist(
        (...a) => ({
            ...createSessionSlice(...a),
            ...createWorkItemSlice(...a),
            ...createChatSlice(...a),
            ...createFeedbackSlice(...a),
        }),
        {
            name: 'voice-ky-v2-session-storage',
            version: 2,
            migrate: (persisted, version) => {
                if (!persisted || typeof persisted !== 'object') return persisted as KYStore

                // v1 -> v2: countermeasures string[] -> {category,text}[]
                if (version >= 2) return persisted as KYStore
                const state = persisted as unknown as KYStore

                const normalizeMeasures = (values: unknown) => {
                    if (!Array.isArray(values)) return values
                    if (values.every((v) => typeof v === 'string')) {
                        return (values as string[])
                            .map((text) => String(text).trim())
                            .filter(Boolean)
                            .map((text) => ({ category: 'behavior' as const, text }))
                    }
                    return values
                }

                const session = state.session
                if (session) {
                    session.workItems = session.workItems.map((item) => ({
                        ...item,
                        countermeasures: normalizeMeasures((item as { countermeasures?: unknown }).countermeasures) as any,
                    }))
                }

                state.currentWorkItem = {
                    ...state.currentWorkItem,
                    countermeasures: normalizeMeasures((state.currentWorkItem as { countermeasures?: unknown }).countermeasures) as any,
                }

                return state
            },
            partialize: (state) => ({
                session: state.session,
                messages: state.messages,
                currentWorkItem: state.currentWorkItem,
                status: state.status,
                feedback: state.feedback,
                supplements: state.supplements,
                polishedGoal: state.polishedGoal,
                polishedActionGoal: state.polishedActionGoal,
                feedbackSkipped: state.feedbackSkipped,
                feedbackSessionId: state.feedbackSessionId,
            }),
        }
    )
)
