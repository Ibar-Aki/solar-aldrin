import { useEffect, useRef } from 'react'
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition'
import { useTTSStore } from '@/stores/useTTSStore'
import type { VoiceConversationMode } from '@/stores/useVoiceConversationModeStore'
import { Mic, Square } from 'lucide-react'

interface MicButtonProps {
    onTranscript: (text: string) => void
    disabled?: boolean
    inputValue: string
    onErrorChange?: (error: string | null) => void
    onFinalTranscript?: (text: string) => void
    voiceMode?: VoiceConversationMode
    autoStart?: boolean
    autoStartEnabled?: boolean
}

export function MicButton({
    onTranscript,
    disabled = false,
    inputValue,
    onErrorChange,
    onFinalTranscript,
    voiceMode = 'normal',
    autoStart = false,
    autoStartEnabled = true,
}: MicButtonProps) {
    const isTTSSpeaking = useTTSStore((s) => s.isSpeaking)
    const isFullVoiceMode = voiceMode === 'full_voice'

    /** ユーザーが手動で停止したかどうか（強制停止と区別するため） */
    const userStoppedRef = useRef(false)
    /** 強制停止前にリスニング中だったか（復帰判定用） */
    const wasListeningBeforePauseRef = useRef(false)
    /** 自動開始の重複防止 */
    const autoStartTriggeredRef = useRef(false)

    const {
        isListening,
        isSupported,
        start,
        stop,
        error,
        setAutoRestart,
        clearError,
    } = useVoiceRecognition({
        autoRestart: isFullVoiceMode,
        onResult: (transcript, isFinal) => {
            const normalized = transcript.trim()
            if (!normalized) return

            // 完全音声会話では中間結果も表示して、無反応に見える時間を減らす。
            if (isFullVoiceMode || isFinal) {
                onTranscript(normalized)
            }
            if (isFinal) {
                onFinalTranscript?.(normalized)
            }
        },
    })

    // エラーが表示されていても、入力が1文字でも入ったら消す（入力欄の圧迫防止）
    useEffect(() => {
        if (error && inputValue.trim().length > 0) {
            clearError()
        }
    }, [error, inputValue, clearError])

    useEffect(() => {
        onErrorChange?.(error)
    }, [error, onErrorChange])

    /** 強制停止が必要な条件 */
    const shouldForcePause = disabled || isTTSSpeaking
    const shouldAutoStart = (autoStart || isFullVoiceMode) && autoStartEnabled

    useEffect(() => {
        setAutoRestart(isFullVoiceMode)
    }, [isFullVoiceMode, setAutoRestart])

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
                // 同一更新で自動開始エフェクトが重なっても、start の多重実行を防ぐ
                autoStartTriggeredRef.current = true
                start()
            }
        }
    }, [shouldForcePause, isListening, start, stop, isSupported])

    useEffect(() => {
        if (!shouldAutoStart) {
            autoStartTriggeredRef.current = false
            return
        }
        if (!isSupported || shouldForcePause || isListening || userStoppedRef.current) return
        if (autoStartTriggeredRef.current) return
        autoStartTriggeredRef.current = true
        start()
    }, [shouldAutoStart, isSupported, shouldForcePause, isListening, start])

    useEffect(() => {
        if (!shouldForcePause) return
        autoStartTriggeredRef.current = false
    }, [shouldForcePause])

    useEffect(() => {
        if (isListening) {
            autoStartTriggeredRef.current = false
        }
    }, [isListening])

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
            // fatal error で自動再開が落ちた後も、手動開始で復帰できるようにする。
            if (isFullVoiceMode) {
                setAutoRestart(true)
            }
            start()
        }
    }

    return (
        <div className="shrink-0">
            <button
                type="button"
                onClick={handleClick}
                disabled={shouldForcePause}
                className={`
          w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-sm
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
                    <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
            </button>
        </div>
    )
}
