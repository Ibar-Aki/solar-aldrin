import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ChatBubble } from '@/components/ChatBubble'
import type { ChatMessage } from '@/types/ky'

const speakMock = vi.fn()
const cancelMock = vi.fn()

vi.mock('@/hooks/useTTS', () => ({
    useTTS: () => ({
        speak: speakMock,
        cancel: cancelMock,
        isSpeaking: false,
        isSupported: true,
    }),
}))

describe('ChatBubble auto speak', () => {
    beforeEach(() => {
        speakMock.mockClear()
        cancelMock.mockClear()
    })

    it('完全音声会話モード時にAIメッセージを自動読み上げする（1回のみ）', () => {
        const message: ChatMessage = {
            id: 'assistant-message-1',
            role: 'assistant',
            content: '危険ポイントを教えてください。',
            timestamp: new Date().toISOString(),
        }

        const { rerender } = render(<ChatBubble message={message} autoSpeak />)
        rerender(<ChatBubble message={message} autoSpeak />)

        expect(speakMock).toHaveBeenCalledTimes(1)
        expect(speakMock).toHaveBeenCalledWith('危険ポイントを教えてください。')
    })

    it('ユーザーメッセージでは自動読み上げしない', () => {
        const message: ChatMessage = {
            id: 'user-message-1',
            role: 'user',
            content: '安全帯を使います',
            timestamp: new Date().toISOString(),
        }

        render(<ChatBubble message={message} autoSpeak />)
        expect(speakMock).not.toHaveBeenCalled()
    })
})
