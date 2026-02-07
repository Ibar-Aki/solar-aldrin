/**
 * Web Speech API (SpeechRecognition) error normalization + message mapping.
 *
 * Notes:
 * - Some environments may return `service not allowed` (space separated). Normalize to `service-not-allowed`.
 * - UI shows errors as a single line; keep user-facing messages short.
 */

export type SpeechRecognitionErrorCode =
    | 'not-allowed'
    | 'no-speech'
    | 'network'
    | 'audio-capture'
    | 'service-not-allowed'
    | string

export function normalizeSpeechRecognitionError(raw: string): SpeechRecognitionErrorCode {
    const e = (raw ?? '').trim()
    if (!e) return ''

    const lower = e.toLowerCase()
    if (lower === 'service not allowed') return 'service-not-allowed'

    return e
}

export function getSpeechRecognitionErrorMessage(error: SpeechRecognitionErrorCode): string {
    switch (error) {
        case 'not-allowed':
            return 'マイクの使用が許可されていません'
        case 'no-speech':
            return '音声が検出されませんでした'
        case 'network':
            return 'ネットワークエラーが発生しました'
        case 'audio-capture':
            return 'マイクにアクセスできません'
        case 'service-not-allowed':
            return 'この環境では音声認識が利用できません'
        default:
            return `音声認識エラー: ${error}`
    }
}

