import type { ChatMessage } from '@/types/ky'
import { useTTS } from '@/hooks/useTTS'
import { Volume2, Square } from 'lucide-react'

interface ChatBubbleProps {
    message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
    const isUser = message.role === 'user'
    const { speak, cancel, isSpeaking, isSupported } = useTTS({ messageId: message.id })

    const handleSpeak = () => {
        if (isSpeaking) {
            cancel()
        } else {
            speak(message.content)
        }
    }

    const timeLabel = new Date(message.timestamp).toLocaleTimeString('ja-JP', {
        hour: 'numeric',
        minute: '2-digit'
    })

    return (
        <div className="mb-3 w-full" data-testid="chat-bubble" data-role={message.role}>
            <div className={`flex w-full items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {isUser && (
                    <span className="shrink-0 text-xs text-gray-400" aria-label={`時刻 ${timeLabel}`}>
                        {timeLabel}
                    </span>
                )}

                <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${isUser
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}
                >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* AIメッセージの場合: 読み上げボタンは時刻の上に表示 */}
                {!isUser && (
                    <div className="shrink-0 flex flex-col items-center gap-0.5">
                        {isSupported && (
                            <button
                                onClick={handleSpeak}
                                className="p-2 text-gray-400 hover:text-blue-500 rounded-full hover:bg-gray-100 transition-colors"
                                title={isSpeaking ? "読み上げ停止" : "読み上げ"}
                            >
                                {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                            </button>
                        )}
                        <span className="text-xs text-gray-400" aria-label={`時刻 ${timeLabel}`}>
                            {timeLabel}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
