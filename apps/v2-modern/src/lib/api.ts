/**
 * API クライアント
 * Chat API との通信を fetch ベースで実装
 * 
 * 型定義は lib/schema.ts の Zod スキーマから推論した型を使用
 */
import {
    ChatResponseSchema,
    FeedbackApiResponseSchema,
    type ChatRequest,
    type ChatSuccessResponse,
    type FeedbackRequest,
    type FeedbackResponse,
} from '@/lib/schema'
import { normalizeApiBaseFromEnv } from '@/lib/apiBase'

function resolveApiBase(): string {
    return normalizeApiBaseFromEnv(import.meta.env.VITE_API_BASE_URL, '/api')
}

const API_BASE = resolveApiBase()

export type ChatErrorType = 'network' | 'timeout' | 'rate_limit' | 'auth' | 'server' | 'unknown'

type ApiErrorInit = {
    status?: number
    retriable?: boolean
    errorType?: ChatErrorType
    retryAfterSec?: number
}

export class ApiError extends Error {
    status?: number
    retriable: boolean
    errorType: ChatErrorType
    retryAfterSec?: number

    constructor(message: string, init: ApiErrorInit = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = init.status
        this.retriable = init.retriable ?? false
        this.errorType = init.errorType ?? inferErrorType(init.status)
        this.retryAfterSec = init.retryAfterSec
    }
}

function inferErrorType(status?: number): ChatErrorType {
    if (status === 401) return 'auth'
    if (status === 429) return 'rate_limit'
    if (status === 504) return 'timeout'
    if (typeof status === 'number' && status >= 500) return 'server'
    return 'unknown'
}

/**
 * Chat API を呼び出す
 * エラーレスポンスの場合は例外をスロー
 */
export async function postChat(request: ChatRequest): Promise<ChatSuccessResponse> {
    const token = import.meta.env.VITE_API_TOKEN

    let res: Response
    try {
        res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(request),
        })
    } catch {
        throw new ApiError('通信が不安定です。電波の良い場所で再送してください。', {
            errorType: 'network',
            retriable: false,
        })
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = (errorData as { error?: string }).error || 'AI応答の取得に失敗しました'
        const retryAfterRaw = res.headers.get('Retry-After')
        const retryAfterParsed = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined
        const retryAfterSec = Number.isFinite(retryAfterParsed) ? retryAfterParsed : undefined
        throw new ApiError(errorMessage, {
            status: res.status,
            retriable: Boolean((errorData as { retriable?: boolean }).retriable),
            errorType: inferErrorType(res.status),
            retryAfterSec,
        })
    }

    const data = await res.json()

    // レスポンスの型検証
    const result = ChatResponseSchema.safeParse(data)
    if (!result.success) {
        console.error('Invalid API Response:', result.error)
        throw new ApiError('サーバーからの応答が不正な形式です', {
            status: 502,
            errorType: 'server',
            // 一時的な整合性崩れの可能性があるため、UXとしては再試行可能にする
            retriable: true,
            retryAfterSec: 1,
        })
    }

    const parsed = result.data

    // エラーレスポンスの場合は例外をスロー
    if ('error' in parsed) {
        // Some deployments/proxies may return an "error" payload with 2xx.
        // Preserve retriable metadata when present so the UI can offer retry.
        const ext = parsed as { error: string; retriable?: boolean; requestId?: string; code?: string }
        throw new ApiError(ext.error, {
            status: res.status,
            errorType: inferErrorType(res.status),
            retriable: Boolean(ext.retriable),
        })
    }

    return parsed
}

/**
 * Feedback API を呼び出す
 * 204 の場合は null を返す
 */
export async function postFeedback(
    request: FeedbackRequest,
    options?: { signal?: AbortSignal }
): Promise<FeedbackResponse | null> {
    const token = import.meta.env.VITE_API_TOKEN

    let res: Response
    try {
        res = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(request),
            signal: options?.signal,
        })
    } catch (error) {
        // Abortはユーザー操作なのでエラー扱いしない
        if (error instanceof Error && error.name === 'AbortError') {
            throw error
        }
        throw new ApiError('通信が不安定です。電波の良い場所で再送してください。', {
            errorType: 'network',
            retriable: false,
        })
    }

    if (res.status === 204) {
        return null
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const message = (errorData as { error?: { message?: string } })?.error?.message
        const retryAfterRaw = res.headers.get('Retry-After')
        const retryAfterParsed = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined
        const retryAfterSec = Number.isFinite(retryAfterParsed) ? retryAfterParsed : undefined
        throw new ApiError(message || 'フィードバックの取得に失敗しました', {
            status: res.status,
            retriable: res.status === 429 || res.status >= 500,
            errorType: inferErrorType(res.status),
            retryAfterSec,
        })
    }

    const data = await res.json()
    const result = FeedbackApiResponseSchema.safeParse(data)
    if (!result.success) {
        console.error('Invalid Feedback API Response:', result.error)
        throw new ApiError('サーバーからの応答が不正な形式です', {
            status: 502,
            errorType: 'server',
            retriable: true,
            retryAfterSec: 1,
        })
    }

    const parsed = result.data
    if ('error' in parsed) {
        throw new ApiError(parsed.error.message, {
            errorType: 'unknown',
            retriable: parsed.error.retriable ?? false,
        })
    }

    return parsed
}

// 型を再エクスポート（利便性のため）
export type { ChatRequest, ChatSuccessResponse, FeedbackRequest, FeedbackResponse }
