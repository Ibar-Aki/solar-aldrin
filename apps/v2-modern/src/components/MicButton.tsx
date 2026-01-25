import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'

interface MicButtonProps {
    onTranscript: (text: string) => void
    disabled?: boolean
}

export function MicButton({ onTranscript, disabled = false }: MicButtonProps) {

    const {
        isListening,
        isSupported,
        start,
        stop,
        error
    } = useVoiceRecognition({
        autoRestart: true,
        onResult: (transcript, isFinal) => {
            if (isFinal && transcript.trim()) {
                onTranscript(transcript.trim())
            }
        },
    })

    // 音声非対応ブラウザでは表示しない
    if (!isSupported) {
        return null
    }

    // TTS発話中は音声認識を停止（将来的にはTTSとの連携を実装）
    const effectivelyDisabled = disabled

    const handleClick = () => {
        if (isListening) {
            stop()
        } else {
            start()
        }
    }

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                onClick={handleClick}
                disabled={effectivelyDisabled}
                className={`
          w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-200
          ${isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }
          ${effectivelyDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
                aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
            >
                {isListening ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                ) : (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                )}
            </button>

            <span className="text-xs text-gray-500">
                {isListening ? '聞いています...' : 'タップして話す'}
            </span>

            {error && (
                <span className="text-xs text-red-500">{error}</span>
            )}
        </div>
    )
}
