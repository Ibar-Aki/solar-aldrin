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

const DEFAULT_RESTART_DELAY_MS = 500
const START_WATCHDOG_MS = 2500
const AUDIO_CAPTURE_RETRY_DELAYS_MS = [500, 1000, 2000] as const

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
    const [restartDelayMs, setRestartDelayMs] = useState(DEFAULT_RESTART_DELAY_MS)

    const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
    const lastSpeechTimeRef = useRef<number>(0)
    const isStoppingRef = useRef(false)
    const isStartingRef = useRef(false)
    const hasStartedRef = useRef(false)
    const isListeningRef = useRef(false)
    const startWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingRetryReasonRef = useRef<'audio-capture' | null>(null)
    const audioCaptureRetryCountRef = useRef(0)

    const isSupported = !!SpeechRecognition

    // 10秒無音で自動停止
    const SILENCE_TIMEOUT = 10000
    const clearStartWatchdog = useCallback(() => {
        if (startWatchdogTimerRef.current) {
            clearTimeout(startWatchdogTimerRef.current)
            startWatchdogTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        isListeningRef.current = isListening
    }, [isListening])

    const stop = useCallback(() => {
        clearStartWatchdog()
        isStoppingRef.current = true
        isStartingRef.current = false
        pendingRetryReasonRef.current = null
        audioCaptureRetryCountRef.current = 0
        setRestartDelayMs(DEFAULT_RESTART_DELAY_MS)
        if (recognitionRef.current) {
            recognitionRef.current.stop()
        }
        setIsListening(false)
    }, [clearStartWatchdog])

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    const start = useCallback(() => {
        if (isStartingRef.current || isListeningRef.current) return

        if (!isSupported) {
            const msg = 'このブラウザは音声認識に対応していません'
            setError((prev) => (prev === msg ? prev : msg))
            onError?.(msg)
            return
        }

        isStoppingRef.current = false
        isStartingRef.current = true
        setError(null)
        setTranscript('')
        const isAudioCaptureRetry = pendingRetryReasonRef.current === 'audio-capture'
        pendingRetryReasonRef.current = null
        if (!isAudioCaptureRetry) {
            audioCaptureRetryCountRef.current = 0
            setRestartDelayMs(DEFAULT_RESTART_DELAY_MS)
        }
        // 初回起動失敗でも autoRestart による再試行が機能するよう、
        // 「開始試行済み」フラグは onstart 前に立てる。
        hasStartedRef.current = true

        try {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop()
                } catch {
                    // no-op
                }
                recognitionRef.current = null
            }

            const recognition = new SpeechRecognition()
            recognition.lang = lang
            recognition.continuous = continuous
            recognition.interimResults = true
            const isCurrentRecognition = () => recognitionRef.current === recognition

            recognition.onstart = () => {
                if (!isCurrentRecognition()) return
                clearStartWatchdog()
                setIsListening(true)
                isStartingRef.current = false
                lastSpeechTimeRef.current = Date.now()
                setRestartDelayMs(DEFAULT_RESTART_DELAY_MS)
            }

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                if (!isCurrentRecognition()) return
                lastSpeechTimeRef.current = Date.now()
                audioCaptureRetryCountRef.current = 0

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
                if (!isCurrentRecognition()) return
                clearStartWatchdog()
                const normalized = normalizeSpeechRecognitionError(event.error)
                console.error('Speech recognition error:', normalized)
                isStartingRef.current = false

                // 一時的なエラーは無視
                if (normalized === 'no-speech' || normalized === 'aborted') {
                    return
                }

                const isFatal =
                    normalized === 'not-allowed' ||
                    normalized === 'service-not-allowed'

                const isAudioCapture = normalized === 'audio-capture'

                // 致命的なエラーの場合は止めて悪化（エラー連打）を防ぐ
                if (isFatal) {
                    setAutoRestart(false)
                    isStoppingRef.current = true // 意図的な停止とみなす（自動再開を抑制）
                    pendingRetryReasonRef.current = null
                    audioCaptureRetryCountRef.current = 0
                    setRestartDelayMs(DEFAULT_RESTART_DELAY_MS)
                    try {
                        recognition.stop()
                    } catch {
                        // no-op
                    }
                    setIsListening(false)
                }

                if (isAudioCapture) {
                    setIsListening(false)
                    const retryIndex = audioCaptureRetryCountRef.current
                    if (retryIndex < AUDIO_CAPTURE_RETRY_DELAYS_MS.length) {
                        pendingRetryReasonRef.current = 'audio-capture'
                        audioCaptureRetryCountRef.current = retryIndex + 1
                        setRestartDelayMs(AUDIO_CAPTURE_RETRY_DELAYS_MS[retryIndex])
                    } else {
                        setAutoRestart(false)
                        isStoppingRef.current = true
                        pendingRetryReasonRef.current = null
                        audioCaptureRetryCountRef.current = retryIndex + 1
                        setRestartDelayMs(DEFAULT_RESTART_DELAY_MS)
                        try {
                            recognition.stop()
                        } catch {
                            // no-op
                        }
                    }
                } else {
                    pendingRetryReasonRef.current = null
                    setRestartDelayMs(DEFAULT_RESTART_DELAY_MS)
                }

                const exceededAudioCaptureRetries =
                    isAudioCapture && audioCaptureRetryCountRef.current > AUDIO_CAPTURE_RETRY_DELAYS_MS.length
                const errorMessage =
                    exceededAudioCaptureRetries
                        ? 'マイクにアクセスできません。マイク設定を確認して再試行してください'
                        : getSpeechRecognitionErrorMessage(normalized)
                setError((prev) => (prev === errorMessage ? prev : errorMessage))
                onError?.(errorMessage)
            }

            recognition.onend = () => {
                if (!isCurrentRecognition()) return
                clearStartWatchdog()
                setIsListening(false)
                isStartingRef.current = false
                recognitionRef.current = null
            }

            recognitionRef.current = recognition
            recognition.start()
            clearStartWatchdog()
            startWatchdogTimerRef.current = setTimeout(() => {
                if (!isCurrentRecognition()) return
                console.warn('Speech recognition start watchdog timeout')
                isStartingRef.current = false
                recognitionRef.current = null
                setIsListening(false)
                try {
                    recognition.stop()
                } catch {
                    // no-op
                }
                const msg = '音声認識の開始に時間がかかっています。再試行します'
                setError((prev) => (prev === msg ? prev : msg))
                onError?.(msg)
            }, START_WATCHDOG_MS)

        } catch (e) {
            console.error('Failed to start speech recognition:', e)
            clearStartWatchdog()
            isStartingRef.current = false
            const msg = '音声認識の開始に失敗しました'
            setError((prev) => (prev === msg ? prev : msg))
            onError?.(msg)
        }
    }, [isSupported, lang, continuous, onResult, onError, clearStartWatchdog])

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
        if (!hasStartedRef.current) return
        if (!isListening && autoRestart && !isStoppingRef.current && isSupported) {
            const timer = setTimeout(() => {
                start()
            }, restartDelayMs)
            return () => clearTimeout(timer)
        }
    }, [isListening, autoRestart, isSupported, start, error, restartDelayMs])

    // クリーンアップ
    useEffect(() => {
        return () => {
            clearStartWatchdog()
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
            isStartingRef.current = false
            pendingRetryReasonRef.current = null
            audioCaptureRetryCountRef.current = 0
        }
    }, [clearStartWatchdog])

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
