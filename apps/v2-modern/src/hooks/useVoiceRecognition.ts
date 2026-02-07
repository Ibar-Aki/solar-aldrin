/**
 * 音声認識フック
 * Web Speech API のラッパー（オプション機能）
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { getSpeechRecognitionErrorMessage, normalizeSpeechRecognitionError } from '@/lib/speechRecognitionErrors'

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
    clearError: () => void
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

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    const start = useCallback(() => {
        if (!isSupported) {
            const msg = 'このブラウザは音声認識に対応していません'
            setError((prev) => (prev === msg ? prev : msg))
            onError?.(msg)
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
                const normalized = normalizeSpeechRecognitionError(event.error)
                console.error('Speech recognition error:', normalized)

                // 一時的なエラーは無視
                if (normalized === 'no-speech' || normalized === 'aborted') {
                    return
                }

                const isFatal =
                    normalized === 'not-allowed' ||
                    normalized === 'audio-capture' ||
                    normalized === 'service-not-allowed'

                // 致命的なエラーの場合は止めて悪化（エラー連打）を防ぐ
                if (isFatal) {
                    setAutoRestart(false)
                    isStoppingRef.current = true // 意図的な停止とみなす（自動再開を抑制）
                    try {
                        recognitionRef.current?.stop()
                    } catch {
                        // no-op
                    }
                    setIsListening(false)
                }

                const errorMessage = getSpeechRecognitionErrorMessage(normalized)
                setError((prev) => (prev === errorMessage ? prev : errorMessage))
                onError?.(errorMessage)
            }

            recognition.onend = () => {
                setIsListening(false)
            }

            recognitionRef.current = recognition
            recognition.start()

        } catch (e) {
            console.error('Failed to start speech recognition:', e)
            const msg = '音声認識の開始に失敗しました'
            setError((prev) => (prev === msg ? prev : msg))
            onError?.(msg)
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
        clearError,
    }
}
