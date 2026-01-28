/**
 * 一人KY セッション用 Zustand ストア (Refactored: Sliced)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice'
import { createWorkItemSlice, type WorkItemSlice } from './slices/workItemSlice'
import { createChatSlice, type ChatSlice } from './slices/chatSlice'

export type KYStore = SessionSlice & WorkItemSlice & ChatSlice

export const useKYStore = create<KYStore>()(
    persist(
        (...a) => ({
            ...createSessionSlice(...a),
            ...createWorkItemSlice(...a),
            ...createChatSlice(...a),
        }),
        {
            name: 'voice-ky-v2-session-storage',
            partialize: (state) => ({
                session: state.session,
                messages: state.messages,
                currentWorkItem: state.currentWorkItem,
                status: state.status,
            }),
        }
    )
)
