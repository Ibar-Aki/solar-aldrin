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

const API_BASE = '/api'

/**
 * Chat API を呼び出す
 * エラーレスポンスの場合は例外をスロー
 */
export async function postChat(request: ChatRequest): Promise<ChatSuccessResponse> {
    const token = import.meta.env.VITE_API_TOKEN

    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
    })

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error((errorData as { error?: string }).error || 'AI応答の取得に失敗しました')
    }

    const data = await res.json()

    // レスポンスの型検証
    const result = ChatResponseSchema.safeParse(data)
    if (!result.success) {
        console.error('Invalid API Response:', result.error)
        throw new Error('サーバーからの応答が不正な形式です')
    }

    const parsed = result.data

    // エラーレスポンスの場合は例外をスロー
    if ('error' in parsed) {
        throw new Error(parsed.error)
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

    const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
        signal: options?.signal,
    })

    if (res.status === 204) {
        return null
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const message = (errorData as { error?: { message?: string } })?.error?.message
        throw new Error(message || 'フィードバックの取得に失敗しました')
    }

    const data = await res.json()
    const result = FeedbackApiResponseSchema.safeParse(data)
    if (!result.success) {
        console.error('Invalid Feedback API Response:', result.error)
        throw new Error('サーバーからの応答が不正な形式です')
    }

    const parsed = result.data
    if ('error' in parsed) {
        throw new Error(parsed.error.message)
    }

    return parsed
}

// 型を再エクスポート（利便性のため）
export type { ChatRequest, ChatSuccessResponse, FeedbackRequest, FeedbackResponse }
