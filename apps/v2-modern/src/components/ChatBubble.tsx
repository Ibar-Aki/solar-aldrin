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
        <div
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
            data-testid="chat-bubble"
            data-role={message.role}
        >
            {/* AIメッセージの場合は左側にスピーカーアイコンを表示 */}
            {!isUser && isSupported && (
                <button
                    onClick={handleSpeak}
                    className="mr-2 p-2 text-gray-400 hover:text-blue-500 rounded-full hover:bg-gray-100 transition-colors self-end mb-1"
                    title={isSpeaking ? "読み上げ停止" : "読み上げ"}
                >
                    {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                </button>
            )}

            <div className="flex items-end">
                <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${isUser
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}
                >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {isUser ? (
                    <span className="mr-2 text-xs text-gray-400 order-first" aria-label={`時刻 ${timeLabel}`}>
                        {timeLabel}
                    </span>
                ) : (
                    <span className="ml-2 text-xs text-gray-400" aria-label={`時刻 ${timeLabel}`}>
                        {timeLabel}
                    </span>
                )}
            </div>
        </div>
    )
}
