/**
 * 音声合成（Text-to-Speech）フック
 * Web Speech API wrapper + グローバル状態連携
 */
import { useCallback, useEffect, useRef } from 'react'
import { useTTSStore } from '@/stores/useTTSStore'

/** TTS再生のフォールバックタイムアウト (ms) - onendが発火しない場合用 */
const TTS_FALLBACK_TIMEOUT_MS = 30000
/** Store上で「再生中」のまま固着した場合の自己回復しきい値 */
const TTS_STUCK_GUARD_MS = 2000

/** 音声リストのキャッシュ */
let cachedVoices: SpeechSynthesisVoice[] = []

interface UseTTSOptions {
    /** このメッセージの一意な識別子 */
    messageId: string
}

export function useTTS({ messageId }: UseTTSOptions) {
    const isAnySpeaking = useTTSStore((state) => state.isSpeaking)
    const currentMessageId = useTTSStore((state) => state.currentMessageId)
    const startSpeaking = useTTSStore((state) => state.startSpeaking)
    const stopSpeaking = useTTSStore((state) => state.stopSpeaking)
    const isThisSpeaking = useTTSStore((state) => state.isSpeaking && state.currentMessageId === messageId)
    const synthRef = useRef<SpeechSynthesis | null>(null)
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const utteranceIdRef = useRef(0)
    const notSpeakingSinceRef = useRef<number | null>(null)
    const pendingReplayTextRef = useRef<string | null>(null)
    const replayAttemptedTextRef = useRef<string | null>(null)
    const replayHandlerRef = useRef<(() => void) | null>(null)
    const speakRef = useRef<(text: string) => void>(() => {})

    const isSupported = typeof window !== 'undefined' && !!window.speechSynthesis

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            synthRef.current = window.speechSynthesis
        }
    }, [])

    /** フォールバックタイマーをクリア */
    const clearFallbackTimer = useCallback(() => {
        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current)
            fallbackTimerRef.current = null
        }
    }, [])

    const clearReplayHandler = useCallback(() => {
        if (!replayHandlerRef.current) return
        window.removeEventListener('pointerdown', replayHandlerRef.current, true)
        window.removeEventListener('touchstart', replayHandlerRef.current, true)
        window.removeEventListener('keydown', replayHandlerRef.current, true)
        replayHandlerRef.current = null
    }, [])

    const queueReplayOnUserInteraction = useCallback((text: string) => {
        if (typeof window === 'undefined') return
        pendingReplayTextRef.current = text
        if (replayHandlerRef.current) return

        const replay = () => {
            const queued = pendingReplayTextRef.current
            pendingReplayTextRef.current = null
            clearReplayHandler()
            if (!queued) return
            replayAttemptedTextRef.current = queued
            speakRef.current(queued)
        }
        replayHandlerRef.current = replay
        window.addEventListener('pointerdown', replay, true)
        window.addEventListener('touchstart', replay, true)
        window.addEventListener('keydown', replay, true)
    }, [clearReplayHandler])

    /**
     * テキストを読み上げる
     */
    const speak = useCallback((text: string) => {
        if (!synthRef.current) return
        if (!text.trim()) return

        // 既存の読み上げをキャンセル（他メッセージ含む）
        synthRef.current.cancel()
        clearFallbackTimer()
        notSpeakingSinceRef.current = null

        const utteranceId = ++utteranceIdRef.current
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'ja-JP'
        utterance.rate = 1.2
        utterance.pitch = 1.0
        utterance.volume = 1.0

        // 音声の選択（Google 日本語などを優先）
        // キャッシュがあればそれを使用、なければ取得してキャッシュ
        let voices = cachedVoices
        if (voices.length === 0) {
            voices = synthRef.current.getVoices()
            if (voices.length > 0) {
                cachedVoices = voices
            }
        }

        const jpVoice = voices.find(v => v.lang === 'ja-JP' && v.name.includes('Google')) ||
            voices.find(v => v.lang === 'ja-JP')

        if (jpVoice) {
            utterance.voice = jpVoice
        }

        const isCurrentUtterance = () => {
            const { currentMessageId: activeMessageId } = useTTSStore.getState()
            // onstart 前に onerror が先行する環境があるため、activeMessageId=null も許容する。
            const isNotPreemptedByOtherMessage = activeMessageId === null || activeMessageId === messageId
            return isNotPreemptedByOtherMessage && utteranceIdRef.current === utteranceId
        }

        utterance.onstart = () => {
            notSpeakingSinceRef.current = null
            replayAttemptedTextRef.current = null
            pendingReplayTextRef.current = null
            clearReplayHandler()
            startSpeaking(messageId)
        }

        utterance.onend = () => {
            if (!isCurrentUtterance()) return
            clearFallbackTimer()
            notSpeakingSinceRef.current = null
            stopSpeaking()
        }

        utterance.onerror = (e) => {
            console.error('TTS Error:', e)
            if (!isCurrentUtterance()) return
            clearFallbackTimer()
            notSpeakingSinceRef.current = null
            stopSpeaking()

            const maybeError = e as { error?: unknown }
            const errorCode = typeof maybeError.error === 'string' ? maybeError.error : ''
            const shouldQueueReplay =
                errorCode === 'not-allowed' &&
                replayAttemptedTextRef.current !== text
            if (shouldQueueReplay) {
                queueReplayOnUserInteraction(text)
            }
        }

        synthRef.current.speak(utterance)

        // フォールバック: onend が発火しない場合に備えてタイムアウトで強制終了
        fallbackTimerRef.current = setTimeout(() => {
            if (isCurrentUtterance()) {
                console.warn('TTS fallback timeout triggered')
                synthRef.current?.cancel()
                notSpeakingSinceRef.current = null
                stopSpeaking()
            }
        }, TTS_FALLBACK_TIMEOUT_MS)
    }, [messageId, startSpeaking, stopSpeaking, clearFallbackTimer, clearReplayHandler, queueReplayOnUserInteraction])
    speakRef.current = speak

    /**
     * 読み上げ停止
     */
    const cancel = useCallback(() => {
        clearFallbackTimer()
        notSpeakingSinceRef.current = null
        pendingReplayTextRef.current = null
        clearReplayHandler()
        if (synthRef.current) {
            synthRef.current.cancel()
        }
        // 自分が再生中の場合のみストアをクリア
        if (currentMessageId === messageId) {
            stopSpeaking()
        }
    }, [messageId, currentMessageId, stopSpeaking, clearFallbackTimer, clearReplayHandler])

    // アンマウント時のクリーンアップ
    useEffect(() => {
        return () => {
            clearFallbackTimer()
            notSpeakingSinceRef.current = null
            pendingReplayTextRef.current = null
            clearReplayHandler()
            // 自分が再生中ならキャンセル
            if (useTTSStore.getState().currentMessageId === messageId) {
                synthRef.current?.cancel()
                stopSpeaking()
            }
        }
    }, [messageId, stopSpeaking, clearFallbackTimer, clearReplayHandler])

    // iOS/Safari などで onend/onerror が不発のまま state が固着した場合の復帰。
    useEffect(() => {
        if (!synthRef.current) return
        if (!isAnySpeaking || currentMessageId !== messageId) return

        const interval = window.setInterval(() => {
            const synth = synthRef.current
            if (!synth) return
            if (synth.speaking || synth.pending) {
                notSpeakingSinceRef.current = null
                return
            }

            const now = Date.now()
            if (notSpeakingSinceRef.current === null) {
                notSpeakingSinceRef.current = now
                return
            }
            if (now - notSpeakingSinceRef.current < TTS_STUCK_GUARD_MS) return

            clearFallbackTimer()
            notSpeakingSinceRef.current = null
            stopSpeaking()
        }, 250)

        return () => window.clearInterval(interval)
    }, [isAnySpeaking, currentMessageId, messageId, stopSpeaking, clearFallbackTimer])

    return {
        speak,
        cancel,
        /** このメッセージが再生中か */
        isSpeaking: isThisSpeaking,
        /** グローバルで何かが再生中か */
        isAnySpeaking,
        isSupported
    }
}

