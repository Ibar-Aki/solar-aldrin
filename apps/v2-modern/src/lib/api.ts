/**
 * API クライアント
 * Chat API との通信を fetch ベースで実装
 * 
 * 型定義は lib/schema.ts の Zod スキーマから推論した型を使用
 */
import { ChatResponseSchema, type ChatRequest, type ChatSuccessResponse } from '@/lib/schema'

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

// 型を再エクスポート（利便性のため）
export type { ChatRequest, ChatSuccessResponse }
