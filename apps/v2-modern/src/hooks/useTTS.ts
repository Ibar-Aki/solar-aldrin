/**
 * 音声合成（Text-to-Speech）フック
 * Web Speech API wrapper + グローバル状態連携
 */
import { useCallback, useEffect, useRef } from 'react'
import { useTTSStore } from '@/stores/useTTSStore'

/** TTS再生のフォールバックタイムアウト (ms) - onendが発火しない場合用 */
const TTS_FALLBACK_TIMEOUT_MS = 30000

/** 音声リストのキャッシュ */
let cachedVoices: SpeechSynthesisVoice[] = []

interface UseTTSOptions {
    /** このメッセージの一意な識別子 */
    messageId: string
}

export function useTTS({ messageId }: UseTTSOptions) {
    const { isSpeaking, currentMessageId, startSpeaking, stopSpeaking } = useTTSStore()
    const synthRef = useRef<SpeechSynthesis | null>(null)
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const utteranceIdRef = useRef(0)

    const isSupported = typeof window !== 'undefined' && !!window.speechSynthesis
    /** このメッセージが現在再生中かどうか */
    const isThisSpeaking = isSpeaking && currentMessageId === messageId

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

    /**
     * テキストを読み上げる
     */
    const speak = useCallback((text: string) => {
        if (!synthRef.current) return

        // 既存の読み上げをキャンセル（他メッセージ含む）
        synthRef.current.cancel()
        clearFallbackTimer()

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
            return activeMessageId === messageId && utteranceIdRef.current === utteranceId
        }

        utterance.onstart = () => {
            startSpeaking(messageId)
        }

        utterance.onend = () => {
            if (!isCurrentUtterance()) return
            clearFallbackTimer()
            stopSpeaking()
        }

        utterance.onerror = (e) => {
            console.error('TTS Error:', e)
            if (!isCurrentUtterance()) return
            clearFallbackTimer()
            stopSpeaking()
        }

        synthRef.current.speak(utterance)

        // フォールバック: onend が発火しない場合に備えてタイムアウトで強制終了
        fallbackTimerRef.current = setTimeout(() => {
            if (isCurrentUtterance()) {
                console.warn('TTS fallback timeout triggered')
                synthRef.current?.cancel()
                stopSpeaking()
            }
        }, TTS_FALLBACK_TIMEOUT_MS)
    }, [messageId, startSpeaking, stopSpeaking, clearFallbackTimer])

    /**
     * 読み上げ停止
     */
    const cancel = useCallback(() => {
        clearFallbackTimer()
        if (synthRef.current) {
            synthRef.current.cancel()
        }
        // 自分が再生中の場合のみストアをクリア
        if (currentMessageId === messageId) {
            stopSpeaking()
        }
    }, [messageId, currentMessageId, stopSpeaking, clearFallbackTimer])

    // アンマウント時のクリーンアップ
    useEffect(() => {
        return () => {
            clearFallbackTimer()
            // 自分が再生中ならキャンセル
            if (useTTSStore.getState().currentMessageId === messageId) {
                synthRef.current?.cancel()
                stopSpeaking()
            }
        }
    }, [messageId, stopSpeaking, clearFallbackTimer])

    return {
        speak,
        cancel,
        /** このメッセージが再生中か */
        isSpeaking: isThisSpeaking,
        /** グローバルで何かが再生中か */
        isAnySpeaking: isSpeaking,
        isSupported
    }
}

