/**
 * 音声認識フック
 * Web Speech API のラッパー（オプション機能）
 */
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseVoiceRecognitionOptions {
    lang?: string
    continuous?: boolean
    autoRestart?: boolean
    onResult?: (transcript: string, isFinal: boolean) => void
    onError?: (error: string) => void
}

interface UseVoiceRecognitionResult {
    isListening: boolean
    isSupported: boolean
    transcript: string
    error: string | null
    start: () => void
    stop: () => void
    setAutoRestart: (enabled: boolean) => void
}

// SpeechRecognition のブラウザ互換性
const SpeechRecognition =
    typeof window !== 'undefined'
        ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition) // eslint-disable-line @typescript-eslint/no-explicit-any
        : null

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}): UseVoiceRecognitionResult {
    const {
        lang = 'ja-JP',
        continuous = true,
        autoRestart: initialAutoRestart = true,
        onResult,
        onError,
    } = options

    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [autoRestart, setAutoRestart] = useState(initialAutoRestart)

    const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
    const lastSpeechTimeRef = useRef<number>(0)
    const isStoppingRef = useRef(false)

    const isSupported = !!SpeechRecognition

    // 10秒無音で自動停止
    const SILENCE_TIMEOUT = 10000

    const stop = useCallback(() => {
        isStoppingRef.current = true
        if (recognitionRef.current) {
            recognitionRef.current.stop()
        }
        setIsListening(false)
    }, [])

    const start = useCallback(() => {
        if (!isSupported) {
            setError('このブラウザは音声認識に対応していません')
            onError?.('このブラウザは音声認識に対応していません')
            return
        }

        isStoppingRef.current = false
        setError(null)
        setTranscript('')

        try {
            const recognition = new SpeechRecognition()
            recognition.lang = lang
            recognition.continuous = continuous
            recognition.interimResults = true

            recognition.onstart = () => {
                setIsListening(true)
                lastSpeechTimeRef.current = Date.now()
            }

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                lastSpeechTimeRef.current = Date.now()

                let interimTranscript = ''
                let finalTranscript = ''

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript
                    } else {
                        interimTranscript += result[0].transcript
                    }
                }

                const currentTranscript = finalTranscript || interimTranscript
                setTranscript(currentTranscript)

                if (finalTranscript) {
                    onResult?.(finalTranscript, true)
                } else if (interimTranscript) {
                    onResult?.(interimTranscript, false)
                }
            }

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error)

                // 一時的なエラーは無視
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    return
                }

                // 致命的なエラーの場合は自動再開を無効化
                if (event.error === 'not-allowed' || event.error === 'audio-capture') {
                    setAutoRestart(false)
                    isStoppingRef.current = true // 意図的な停止とみなす
                }

                const errorMessage = getErrorMessage(event.error)
                setError(errorMessage)
                onError?.(errorMessage)
            }

            recognition.onend = () => {
                setIsListening(false)
            }

            recognitionRef.current = recognition
            recognition.start()

        } catch (e) {
            console.error('Failed to start speech recognition:', e)
            setError('音声認識の開始に失敗しました')
            onError?.('音声認識の開始に失敗しました')
        }
    }, [isSupported, lang, continuous, onResult, onError])

    // 無音タイムアウトチェック
    useEffect(() => {
        if (!isListening) return

        const interval = setInterval(() => {
            if (Date.now() - lastSpeechTimeRef.current > SILENCE_TIMEOUT) {
                console.log('Silence timeout, restarting recognition')
                // 意図的な停止ではないため、isStoppingRef は立てずに stop する
                // これにより onend で autoRestart が発動する
                if (recognitionRef.current) {
                    recognitionRef.current.stop()
                }
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [isListening, stop])

    // 画面非表示時に停止
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && isListening) {
                stop()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [isListening, stop])

    // 自動再開（意図的な停止でない場合）
    useEffect(() => {
        if (!isListening && autoRestart && !isStoppingRef.current && isSupported) {
            const timer = setTimeout(() => {
                start()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [isListening, autoRestart, isSupported, start])

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [])

    return {
        isListening,
        isSupported,
        transcript,
        error,
        start,
        stop,
        setAutoRestart,
    }
}

function getErrorMessage(error: string): string {
    switch (error) {
        case 'not-allowed':
            return 'マイクの使用が許可されていません'
        case 'no-speech':
            return '音声が検出されませんでした'
        case 'network':
            return 'ネットワークエラーが発生しました'
        case 'audio-capture':
            return 'マイクにアクセスできません'
        default:
            return `音声認識エラー: ${error}`
    }
}
