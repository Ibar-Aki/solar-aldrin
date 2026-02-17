import { create } from 'zustand'

export type VoiceConversationMode = 'normal' | 'full_voice'

interface VoiceConversationModeState {
    mode: VoiceConversationMode
    setMode: (mode: VoiceConversationMode) => void
}

export const useVoiceConversationModeStore = create<VoiceConversationModeState>((set) => ({
    mode: 'normal',
    setMode: (mode) => set({ mode }),
}))

