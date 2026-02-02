import type { StateCreator } from 'zustand'
import type { FeedbackSummary, SupplementItem, PolishedGoal } from '@/types/ky'
import type { KYStore } from '../kyStore'

export interface FeedbackSlice {
    feedback: FeedbackSummary | null
    supplements: SupplementItem[]
    polishedGoal: PolishedGoal | null
    polishedActionGoal: string | null
    feedbackLoading: boolean
    feedbackError: string | null
    feedbackSkipped: boolean
    feedbackSessionId: string | null

    setFeedbackResult: (data: {
        feedback: FeedbackSummary
        supplements: SupplementItem[]
        polishedGoal: PolishedGoal | null
        sessionId: string
    }) => void
    clearFeedbackContent: () => void
    setPolishedActionGoal: (goal: string | null) => void
    setFeedbackLoading: (loading: boolean) => void
    setFeedbackError: (error: string | null) => void
    setFeedbackSkipped: (skipped: boolean) => void
    setFeedbackSessionId: (sessionId: string | null) => void
    resetFeedback: () => void
}

const initialState = {
    feedback: null,
    supplements: [],
    polishedGoal: null,
    polishedActionGoal: null,
    feedbackLoading: false,
    feedbackError: null,
    feedbackSkipped: false,
    feedbackSessionId: null,
}

export const createFeedbackSlice: StateCreator<KYStore, [], [], FeedbackSlice> = (set) => ({
    ...initialState,

    setFeedbackResult: (data) => set({
        feedback: data.feedback,
        supplements: data.supplements,
        polishedGoal: data.polishedGoal,
        feedbackSessionId: data.sessionId,
    }),

    clearFeedbackContent: () => set({
        feedback: null,
        supplements: [],
        polishedGoal: null,
        polishedActionGoal: null,
        feedbackError: null,
    }),

    setPolishedActionGoal: (goal) => set({ polishedActionGoal: goal }),
    setFeedbackLoading: (feedbackLoading) => set({ feedbackLoading }),
    setFeedbackError: (feedbackError) => set({ feedbackError }),
    setFeedbackSkipped: (feedbackSkipped) => set({ feedbackSkipped }),
    setFeedbackSessionId: (feedbackSessionId) => set({ feedbackSessionId }),

    resetFeedback: () => set({ ...initialState }),
})
