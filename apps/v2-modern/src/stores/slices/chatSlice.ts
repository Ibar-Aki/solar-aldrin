import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, ExtractedData } from '@/types/ky'
import type { KYStore } from '../kyStore'

export interface ChatSlice {
    messages: ChatMessage[]
    isLoading: boolean
    error: string | null
    errorSource: 'chat' | 'validation' | null

    addMessage: (role: 'user' | 'assistant', content: string, extractedData?: ExtractedData) => void
    clearMessages: () => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null, source?: 'chat' | 'validation') => void
}

const now = () => new Date().toISOString()

export const createChatSlice: StateCreator<KYStore, [], [], ChatSlice> = (set) => ({
    messages: [],
    isLoading: false,
    error: null,
    errorSource: null,

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
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error, source) => set({
        error,
        // Clear source when error is cleared. Default to 'chat' for backwards-compat.
        errorSource: error ? (source ?? 'chat') : null,
    }),
})
