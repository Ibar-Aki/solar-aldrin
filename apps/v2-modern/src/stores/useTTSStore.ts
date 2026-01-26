/**
 * TTS グローバル状態管理ストア
 * 複数メッセージ間での排他制御と音声認識との連携を担う
 */
import { create } from 'zustand'

interface TTSStore {
    /** 現在再生中かどうか */
    isSpeaking: boolean
    /** 再生中のメッセージID（null = 再生なし） */
    currentMessageId: string | null
    /** 再生開始 */
    startSpeaking: (messageId: string) => void
    /** 再生終了 */
    stopSpeaking: () => void
}

export const useTTSStore = create<TTSStore>((set) => ({
    isSpeaking: false,
    currentMessageId: null,

    startSpeaking: (messageId: string) => {
        set({ isSpeaking: true, currentMessageId: messageId })
    },

    stopSpeaking: () => {
        set({ isSpeaking: false, currentMessageId: null })
    },
}))
