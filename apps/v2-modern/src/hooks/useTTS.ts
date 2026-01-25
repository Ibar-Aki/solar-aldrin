/**
 * TTS（音声読み上げ）フック
 * SpeechSynthesis API のラッパー
 */
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseTTSOptions {
    lang?: string
    rate?: number
    pitch?: number
    onStart?: () => void
    onEnd?: () => void
}

interface UseTTSResult {
    isSpeaking: boolean
    isSupported: boolean
    speak: (text: string) => void
    cancel: () => void
}

export function useTTS(options: UseTTSOptions = {}): UseTTSResult {
    const {
        lang = 'ja-JP',
        rate = 1.0,
        pitch = 1.0,
        onStart,
        onEnd,
    } = options

    const [isSpeaking, setIsSpeaking] = useState(false)
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

    // 利用可能な音声を取得
    useEffect(() => {
        if (!isSupported) return

        const loadVoices = () => {
            const availableVoices = speechSynthesis.getVoices()
            setVoices(availableVoices)
        }

        // Chrome等では voiceschanged イベントで非同期にロードされる
        loadVoices()
        speechSynthesis.addEventListener('voiceschanged', loadVoices)

        return () => {
            speechSynthesis.removeEventListener('voiceschanged', loadVoices)
        }
    }, [isSupported])

    // 日本語ボイスを選択
    const getJapaneseVoice = useCallback((): SpeechSynthesisVoice | null => {
        // 優先順位: 日本語ネイティブ > 日本語対応 > デフォルト
        const japaneseVoice = voices.find(v => v.lang === 'ja-JP' && v.localService)
            || voices.find(v => v.lang === 'ja-JP')
            || voices.find(v => v.lang.startsWith('ja'))
            || null
        return japaneseVoice
    }, [voices])

    const speak = useCallback((text: string) => {
        if (!isSupported) {
            console.warn('SpeechSynthesis is not supported')
            return
        }

        // 既存の発話をキャンセル
        speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang
        utterance.rate = rate
        utterance.pitch = pitch

        // 日本語ボイスがあれば使用
        const japaneseVoice = getJapaneseVoice()
        if (japaneseVoice) {
            utterance.voice = japaneseVoice
        }

        utterance.onstart = () => {
            setIsSpeaking(true)
            onStart?.()
        }

        utterance.onend = () => {
            setIsSpeaking(false)
            onEnd?.()
        }

        utterance.onerror = (event) => {
            console.error('TTS error:', event)
            setIsSpeaking(false)
            onEnd?.()
        }

        utteranceRef.current = utterance
        speechSynthesis.speak(utterance)
    }, [isSupported, lang, rate, pitch, getJapaneseVoice, onStart, onEnd])

    const cancel = useCallback(() => {
        if (isSupported) {
            speechSynthesis.cancel()
            setIsSpeaking(false)
        }
    }, [isSupported])

    // クリーンアップ
    useEffect(() => {
        return () => {
            if (isSupported) {
                speechSynthesis.cancel()
            }
        }
    }, [isSupported])

    return {
        isSpeaking,
        isSupported,
        speak,
        cancel,
    }
}
