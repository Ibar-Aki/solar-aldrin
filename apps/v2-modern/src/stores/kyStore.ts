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
