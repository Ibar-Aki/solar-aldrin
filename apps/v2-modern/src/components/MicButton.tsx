import { useEffect, useRef } from 'react'
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'
import { useTTSStore } from '@/stores/useTTSStore'
import { Mic, Square } from 'lucide-react'

interface MicButtonProps {
    onTranscript: (text: string) => void
    disabled?: boolean
}

export function MicButton({ onTranscript, disabled = false }: MicButtonProps) {
    const isTTSSpeaking = useTTSStore((s) => s.isSpeaking)

    /** ユーザーが手動で停止したかどうか（強制停止と区別するため） */
    const userStoppedRef = useRef(false)
    /** 強制停止前にリスニング中だったか（復帰判定用） */
    const wasListeningBeforePauseRef = useRef(false)

    const {
        isListening,
        isSupported,
        start,
        stop,
        error
    } = useVoiceRecognition({
        autoRestart: false, // 手動制御に切り替え
        onResult: (transcript, isFinal) => {
            if (isFinal && transcript.trim()) {
                onTranscript(transcript.trim())
            }
        },
    })

    /** 強制停止が必要な条件 */
    const shouldForcePause = disabled || isTTSSpeaking

    // 強制停止/再開のエフェクト
    useEffect(() => {
        if (!isSupported) return

        if (shouldForcePause) {
            // 停止が必要な場合
            if (isListening) {
                wasListeningBeforePauseRef.current = true
                stop()
            }
        } else {
            // 条件解除 → ユーザーが手動停止していなければ再開
            if (wasListeningBeforePauseRef.current && !userStoppedRef.current) {
                wasListeningBeforePauseRef.current = false
                start()
            }
        }
    }, [shouldForcePause, isListening, start, stop, isSupported])

    // 音声非対応ブラウザでは表示しない
    // Note: Hooks are now called before this check
    if (!isSupported) {
        return null
    }

    const handleClick = () => {
        if (isListening) {
            userStoppedRef.current = true
            stop()
        } else {
            userStoppedRef.current = false
            start()
        }
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <button
                type="button"
                onClick={handleClick}
                disabled={shouldForcePause}
                className={`
          w-10 h-10 rounded-full flex items-center justify-center
          transition-all duration-200
          ${isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-cyan-500 text-white hover:bg-cyan-600'
                    }
          ${shouldForcePause ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
                aria-label={isListening ? '音声認識を停止' : '音声認識を開始'}
            >
                {isListening ? (
                    <Square className="w-5 h-5" />
                ) : (
                    <Mic className="w-5 h-5" />
                )}
            </button>

            {error && (
                <span className="text-[10px] leading-none text-red-500">{error}</span>
            )}
        </div>
    )
}

