import { ApiError, type ChatErrorType } from '@/lib/api'
import { shouldEnableSilentRetryClient, shouldRequireApiTokenClient } from '@/lib/envFlags'

const ENABLE_SILENT_RETRY = shouldEnableSilentRetryClient()
const MAX_SILENT_RETRIES = (() => {
    const raw = import.meta.env.VITE_SILENT_RETRY_MAX
    const parsed = typeof raw === 'string' ? Number.parseInt(raw.trim(), 10) : NaN
    // サーバー主導の再試行に寄せるため既定は0。必要時のみ環境変数で明示的に有効化する。
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(parsed, 2))
})()

export type NormalizedChatError = {
    message: string
    errorType: ChatErrorType
    code?: string
    status?: number
    retriable: boolean
    retryAfterSec?: number
    canRetry: boolean
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
        return error
    }

    if (error instanceof Error) {
        const ext = error as Error & {
            status?: number
            retriable?: boolean
            retryAfterSec?: number
            code?: string
        }
        const lower = error.message.toLowerCase()

        let inferredType: ChatErrorType | undefined
        if (typeof ext.status === 'number') {
            if (ext.status === 401) inferredType = 'auth'
            else if (ext.status === 429) inferredType = 'rate_limit'
            else if (ext.status === 504) inferredType = 'timeout'
            else if (ext.status >= 500) inferredType = 'server'
        } else if (error.message.includes('タイムアウト') || lower.includes('timeout')) {
            inferredType = 'timeout'
        } else if (error.message.includes('通信') || lower.includes('network')) {
            inferredType = 'network'
        }

        return new ApiError(error.message, {
            status: ext.status,
            retriable: Boolean(ext.retriable),
            retryAfterSec: ext.retryAfterSec,
            errorType: inferredType,
            code: typeof ext.code === 'string' ? ext.code : undefined,
        })
    }

    return new ApiError('通信が不安定です。電波の良い場所で再送してください。', {
        errorType: 'network',
        retriable: false,
    })
}

export function normalizeChatError(error: unknown): NormalizedChatError {
    const apiError = toApiError(error)
    const retryAfterSec = apiError.retryAfterSec
    const requireAuth = shouldRequireApiTokenClient()

    switch (apiError.errorType) {
        case 'auth':
            return {
                message: requireAuth
                    ? '認証エラーです。ホーム画面の「APIトークン設定」から設定するか、管理者に確認してください。'
                    : '認証エラーです。サーバー側の認証設定を確認してください。',
                errorType: 'auth',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: false,
            }
        case 'network':
            return {
                message: '通信が不安定です。電波の良い場所で再送してください。',
                errorType: 'network',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                // UX: 通信エラーも「もう一度試す」で回復することがあるため、手動リトライは許可する。
                canRetry: true,
            }
        case 'timeout':
            return {
                message: 'AI応答が遅れています。少し待ってから再送してください。',
                errorType: 'timeout',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: true,
            }
        case 'rate_limit':
            return {
                message: retryAfterSec
                    ? `混雑中です。${retryAfterSec}秒ほど待ってから再送してください。`
                    : '混雑中です。少し待ってから再送してください。',
                errorType: 'rate_limit',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: true,
            }
        case 'server':
            if (apiError.code === 'AI_RESPONSE_INVALID_SCHEMA') {
                return {
                    message: 'AI応答の形式チェックに失敗しました。再送してください。',
                    errorType: 'server',
                    code: apiError.code,
                    status: apiError.status,
                    retriable: apiError.retriable,
                    retryAfterSec,
                    canRetry: apiError.retriable,
                }
            }
            if (apiError.code === 'AI_RESPONSE_INVALID_JSON') {
                return {
                    message: 'AI応答のJSON復元に失敗しました。再送してください。',
                    errorType: 'server',
                    code: apiError.code,
                    status: apiError.status,
                    retriable: apiError.retriable,
                    retryAfterSec,
                    canRetry: apiError.retriable,
                }
            }
            return {
                message: apiError.retriable
                    ? 'AIサービスが混雑しています。少し待ってから再送してください。'
                    : 'システムエラーが発生しました。時間をおいて再送してください。',
                errorType: 'server',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: apiError.retriable,
            }
        case 'unknown':
        default:
            return {
                message: apiError.message || '通信エラーが発生しました。再送してください。',
                errorType: 'unknown',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: Boolean(apiError.retriable),
            }
    }
}

export function shouldSilentRetry(error: NormalizedChatError): boolean {
    if (!ENABLE_SILENT_RETRY || MAX_SILENT_RETRIES <= 0) return false
    // 429のときのみ限定的に自動再送を許可。その他は手動リトライへ誘導する。
    if (error.errorType === 'rate_limit' && error.retriable) return true
    return false
}

export function computeSilentRetryDelayMs(error: NormalizedChatError): number {
    const retryAfterSec = error.retryAfterSec
    if (typeof retryAfterSec === 'number' && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
        // 平均応答時間が増えすぎないよう、上限を設ける（UX優先: 即時連打を避ける）
        return Math.min(10, retryAfterSec) * 1000
    }

    const jitter = Math.floor(Math.random() * 400)
    if (error.errorType === 'rate_limit') return 2000 + jitter
    if (error.errorType === 'timeout') return 1200 + jitter
    if (error.errorType === 'server') return 1200 + jitter
    return 0
}

export function shouldLogChatErrorToConsole(error: NormalizedChatError): boolean {
    const mode = import.meta.env.MODE
    if (mode === 'test' || mode === 'vitest') return false

    // 開発環境では観測性を優先する。
    if (import.meta.env.DEV) return true

    // 本番ではノイズを減らし、想定外/重大系に限定して出力する。
    if (error.errorType === 'unknown') return true
    if (error.errorType === 'auth') return true
    if (error.errorType === 'server' && !error.retriable) return true
    return false
}

export { MAX_SILENT_RETRIES }
