import { memo, useEffect, useMemo } from 'react'
import type { ChatMessage } from '@/types/ky'
import { useTTS } from '@/hooks/useTTS'
import { Volume2, Square } from 'lucide-react'

interface ChatBubbleProps {
    message: ChatMessage
    autoSpeak?: boolean
}

const autoSpokenMessageIds = new Set<string>()
const MAX_AUTO_SPOKEN_CACHE = 500

function rememberAutoSpokenMessage(messageId: string) {
    autoSpokenMessageIds.add(messageId)
    if (autoSpokenMessageIds.size <= MAX_AUTO_SPOKEN_CACHE) return
    const oldest = autoSpokenMessageIds.values().next().value
    if (typeof oldest === 'string') {
        autoSpokenMessageIds.delete(oldest)
    }
}

export const ChatBubble = memo(function ChatBubble({ message, autoSpeak = false }: ChatBubbleProps) {
    const isUser = message.role === 'user'
    const { speak, cancel, isSpeaking, isSupported } = useTTS({ messageId: message.id })

    useEffect(() => {
        if (!autoSpeak || isUser || !isSupported) return
        if (!message.content.trim()) return
        if (autoSpokenMessageIds.has(message.id)) return
        rememberAutoSpokenMessage(message.id)
        speak(message.content)
    }, [autoSpeak, isUser, isSupported, message.id, message.content, speak])

    const handleSpeak = () => {
        if (isSpeaking) {
            cancel()
        } else {
            speak(message.content)
        }
    }

    const timeLabel = useMemo(() => new Date(message.timestamp).toLocaleTimeString('ja-JP', {
        hour: 'numeric',
        minute: '2-digit',
    }), [message.timestamp])

    return (
        <div className="mb-3 w-full" data-testid="chat-bubble" data-role={message.role}>
            <div className={`flex w-full items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {isUser && (
                    <span className="shrink-0 text-xs text-[var(--text-soft)]" aria-label={`時刻 ${timeLabel}`}>
                        {timeLabel}
                    </span>
                )}

                <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${isUser
                        ? 'rounded-br-md bg-[var(--brand-600)] text-[var(--brand-foreground)] shadow-sm'
                        : 'rounded-bl-md border border-[color:var(--surface-border)] bg-[var(--surface-card)] text-foreground'
                        }`}
                >
                    <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* AIメッセージの場合: 読み上げボタンは時刻の上に表示 */}
                {!isUser && (
                    <div className="shrink-0 flex flex-col items-center gap-0.5">
                        {isSupported && (
                            <button
                                onClick={handleSpeak}
                                className="rounded-full p-2 text-[var(--text-soft)] transition-colors hover:bg-[var(--brand-50)] hover:text-[var(--brand-600)]"
                                title={isSpeaking ? "読み上げ停止" : "読み上げ"}
                            >
                                {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                            </button>
                        )}
                        <span className="text-xs text-[var(--text-soft)]" aria-label={`時刻 ${timeLabel}`}>
                            {timeLabel}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
})

ChatBubble.displayName = 'ChatBubble'
